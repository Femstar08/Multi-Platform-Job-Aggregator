# Design Specification - Multi-Platform Job Aggregator

## Design Overview

**Architecture Pattern**: Adapter Pattern  
**Design Philosophy**: Separation of Concerns, DRY, SOLID Principles  
**Status**: ✅ Complete

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                           │
│  (URLs, Search Queries, Location, Pagination Settings)     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Main Orchestrator                        │
│  - Input validation                                         │
│  - URL generation from queries                              │
│  - Crawler initialization                                   │
│  - Result aggregation                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Adapter Factory                           │
│  - Site detection from URL                                  │
│  - Adapter instantiation                                    │
│  - Supported sites registry                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   LinkedIn   │  │    Indeed    │  │  Glassdoor   │
│   Adapter    │  │   Adapter    │  │   Adapter    │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ - URL valid  │  │ - URL valid  │  │ - URL valid  │
│ - Search URL │  │ - Search URL │  │ - Search URL │
│ - Extract JS │  │ - Extract JS │  │ - Extract JS │
│ - Extract DOM│  │ - Extract DOM│  │ - Extract DOM│
│ - Normalize  │  │ - Normalize  │  │ - Normalize  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Unified Job Schema                        │
│  - Field validation                                         │
│  - Type checking                                            │
│  - Required field enforcement                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Apify Dataset                            │
│  - JSON storage                                             │
│  - Export to CSV/Excel                                      │
│  - API access                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Base Adapter (Abstract Class)

**Purpose**: Define interface that all site adapters must implement

**Responsibilities**:

- Define abstract methods
- Provide common utility methods
- Enforce adapter contract

**Interface**:

```javascript
class BaseAdapter {
  // Abstract methods (must be implemented)
  isValidUrl(url): boolean
  buildSearchUrl(query, location, page): string
  buildPageUrl(baseUrl, page): string
  extractFromJavaScript(page): Promise<Object|null>
  extractFromDOM(page): Promise<Array<Object>>
  extractFullDetails(page): Promise<Object|null>
  normalizeData(rawData): Object

  // Optional methods
  initialize(): Promise<void>
  cleanup(): Promise<void>
  getSiteConfig(): Object
}
```

**Design Decisions**:

- ✅ Abstract class (not interface) to allow shared utility methods
- ✅ Async methods for I/O operations
- ✅ Separate JS and DOM extraction for flexibility
- ✅ Normalization at adapter level (site-specific logic)

### 2. Adapter Factory (Singleton)

**Purpose**: Route requests to correct adapter based on URL or site name

**Responsibilities**:

- Site detection from URLs
- Adapter instantiation
- Supported sites registry
- Error handling for unsupported sites

**Methods**:

```javascript
class AdapterFactory {
  static createAdapter(siteNameOrUrl, config): BaseAdapter
  static _detectSite(siteNameOrUrl): string
  static getSupportedSites(): Array<string>
  static isSiteSupported(siteName): boolean
}
```

**Site Detection Logic**:

```
Input: URL or site name
  ↓
Is it a URL?
  ├─ Yes → Parse hostname
  │         ├─ Contains 'linkedin.com' → 'linkedin'
  │         ├─ Contains 'indeed.com' → 'indeed'
  │         └─ Contains 'glassdoor.com' → 'glassdoor'
  └─ No → Normalize site name
            ├─ 'linkedin' → 'linkedin'
            ├─ 'indeed' → 'indeed'
            └─ 'glassdoor' → 'glassdoor'
```

**Design Decisions**:

- ✅ Static methods (no state needed)
- ✅ Case-insensitive site detection
- ✅ Clear error messages for unsupported sites
- ✅ Easy to extend (add new case in switch)

### 3. Site Adapters (Concrete Implementations)

#### LinkedIn Adapter

**Site-Specific Logic**:

- URL pattern: `linkedin.com/jobs`
- Pagination: `?start=N` (N = page \* 25)
- JS extraction: JSON-LD scripts
- DOM selectors: `.job-search-card`, `.base-search-card__title`

**Salary Parsing**:

```
Input: "$120,000 - $180,000"
  ↓
Regex: /\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/
  ↓
Output: { min: 120000, max: 180000, currency: 'USD', period: 'year' }
```

#### Indeed Adapter

**Site-Specific Logic**:

- URL pattern: `indeed.com/jobs`
- Pagination: `?start=N` (N = page \* 10)
- JS extraction: `window.mosaic.providerData`
- DOM selectors: `.job_seen_beacon`, `.jobTitle`

**Job Type Normalization**:

```
Input: "Full-time"
  ↓
Lowercase & match
  ├─ Contains 'full' → 'full-time'
  ├─ Contains 'part' → 'part-time'
  ├─ Contains 'contract' → 'contract'
  └─ Contains 'intern' → 'internship'
```

#### Glassdoor Adapter

**Site-Specific Logic**:

- URL pattern: `glassdoor.com/Job`
- Pagination: `?page=N` (N = page + 1)
- JS extraction: `window.__APOLLO_STATE__`
- DOM selectors: `[data-test="jobListing"]`, `[data-test="job-title"]`

**Salary Parsing (K format)**:

```
Input: "$80K - $120K (Employer est.)"
  ↓
Regex: /\$?([\d,]+)K?\s*-\s*\$?([\d,]+)K?/
  ↓
Multiply by 1000 if 'K' present
  ↓
Output: { min: 80000, max: 120000, currency: 'USD', period: 'year' }
```

### 4. Unified Schema

**Purpose**: Consistent data structure across all sources

**Schema Definition**:

```javascript
{
  // Core identifiers (required)
  id: string,                    // Unique job ID
  url: string,                   // Job posting URL
  source: string,                // 'linkedin' | 'indeed' | 'glassdoor'

  // Job details (required)
  title: string,                 // Job title
  company: string,               // Company name
  location: string,              // Job location

  // Compensation (optional)
  salary: {
    min: number | null,          // Minimum salary
    max: number | null,          // Maximum salary
    currency: string | null,     // 'USD', 'EUR', etc.
    period: string | null        // 'year' | 'month' | 'hour'
  },

  // Job information (optional)
  description: string,           // Full job description
  requirements: Array<string>,   // Job requirements
  benefits: Array<string>,       // Company benefits
  jobType: string | null,        // 'full-time' | 'part-time' | 'contract' | 'internship'
  experienceLevel: string | null,// 'entry' | 'mid' | 'senior' | 'executive'

  // Metadata (optional)
  postedDate: string,            // ISO 8601 date
  applicantCount: number | null, // Number of applicants
  companyLogo: string | null,    // Company logo URL
  companyRating: number | null,  // Company rating (0-5)

  // Scraping metadata (required)
  _scrapedAt: string,            // ISO 8601 timestamp
  _site: string                  // Source site name
}
```

**Required Fields**: `['id', 'url', 'source', 'title', 'company']`

**Design Decisions**:

- ✅ Flat structure for easy querying
- ✅ Nullable fields for optional data
- ✅ Consistent naming (camelCase)
- ✅ ISO 8601 for dates
- ✅ Metadata prefixed with underscore

### 5. Main Orchestrator

**Purpose**: Coordinate the scraping process

**Flow**:

```
1. Load Input
   ↓
2. Validate Input
   ↓
3. Generate URLs
   ├─ From startUrls (direct)
   └─ From searchQueries (generate for all sites)
   ↓
4. Initialize Crawler
   ├─ Configure proxies
   ├─ Set concurrency
   └─ Set limits
   ↓
5. For Each URL:
   ├─ Detect site
   ├─ Create adapter
   ├─ Extract data (JS → DOM fallback)
   ├─ Normalize data
   ├─ Validate required fields
   ├─ Save to dataset
   └─ Handle pagination
   ↓
6. Complete
```

**Error Handling Strategy**:

```
Try:
  Extract data
Catch:
  Log error with context
  Try fallback method
  If still fails:
    Log detailed error
    Continue to next URL
```

### 6. Utilities

#### Logger

**Purpose**: Structured logging for debugging and monitoring

**Log Format**:

```javascript
{
  timestamp: "2024-12-04T15:30:00Z",
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  message: "Human-readable message",
  component: "adapter-name",
  context: { /* additional data */ }
}
```

**Design Decisions**:

- ✅ JSON format for easy parsing
- ✅ Contextual information
- ✅ Separate error and stack trace
- ✅ Configurable log levels

#### Field Mapping

**Purpose**: Schema definition and validation

**Exports**:

- `UNIFIED_JOB_SCHEMA` - Schema definition
- `REQUIRED_FIELDS` - Required field list

**Design Decisions**:

- ✅ Single source of truth for schema
- ✅ Easy to update schema
- ✅ Type documentation
- ✅ Validation helpers

## Data Flow Design

### Extraction Flow

```
Page Load
  ↓
Try JavaScript Extraction
  ├─ Check window.__DATA__
  ├─ Check window.__INITIAL_STATE__
  ├─ Check window.__APOLLO_STATE__
  └─ Check JSON-LD scripts
  ↓
Success? ─┬─ Yes → Parse data
          └─ No → Try DOM Extraction
                    ↓
                  Query selectors
                    ↓
                  Extract text content
                    ↓
                  Build data objects
  ↓
Normalize Data
  ↓
Validate Required Fields
  ↓
Save to Dataset
```

### Pagination Flow

```
Process Page
  ↓
Extract Jobs
  ↓
Check Conditions:
  ├─ Current page < maxPages?
  ├─ Total items < maxItems?
  └─ Jobs found on page > 0?
  ↓
All Yes? ─┬─ Yes → Build next page URL
          │         Add to queue
          │         Continue
          └─ No → Stop pagination
```

## Design Patterns Used

### 1. Adapter Pattern ✅

**Purpose**: Provide unified interface for different job sites  
**Benefits**: Easy to add new sites, isolated logic, consistent output

### 2. Factory Pattern ✅

**Purpose**: Create appropriate adapter based on input  
**Benefits**: Centralized creation logic, easy to extend

### 3. Template Method Pattern ✅

**Purpose**: Define algorithm structure in base class  
**Benefits**: Code reuse, consistent behavior

### 4. Strategy Pattern ✅

**Purpose**: Different extraction strategies (JS vs DOM)  
**Benefits**: Flexible, fallback support

## Design Principles

### SOLID Principles

**Single Responsibility** ✅

- Each adapter handles one site
- Factory handles routing
- Main handles orchestration

**Open/Closed** ✅

- Open for extension (add new adapters)
- Closed for modification (existing adapters unchanged)

**Liskov Substitution** ✅

- All adapters interchangeable
- Same interface, different implementations

**Interface Segregation** ✅

- Minimal required methods
- Optional methods for advanced features

**Dependency Inversion** ✅

- Depend on BaseAdapter abstraction
- Not on concrete implementations

### DRY (Don't Repeat Yourself) ✅

- Common logic in BaseAdapter
- Shared utilities (logger, schema)
- Reusable extraction patterns

### KISS (Keep It Simple, Stupid) ✅

- Clear, readable code
- Minimal complexity
- Straightforward flow

## Performance Design

### Concurrency

- Crawlee handles concurrent requests
- Default: 5-10 concurrent pages
- Configurable per deployment

### Memory Management

- Stream results to dataset (no accumulation)
- Limit maxRequestsPerCrawl
- Efficient data structures

### Caching

- No caching (always fresh data)
- Could add in future for repeated queries

## Security Design

### Data Privacy

- Scrape public data only
- No authentication required
- No PII storage

### Rate Limiting

- Proxy rotation support
- Configurable delays
- Respect robots.txt

### Error Exposure

- Don't expose internal errors to users
- Log detailed errors internally
- User-friendly error messages

## Scalability Design

### Horizontal Scaling

- Stateless design
- Can run multiple instances
- No shared state

### Vertical Scaling

- Memory efficient
- CPU efficient (minimal processing)
- I/O bound (network requests)

### Adding New Sites

```
Time: ~1 hour
Steps:
  1. Create adapter file (30 min)
  2. Implement methods (20 min)
  3. Register in factory (5 min)
  4. Write tests (5 min)
```

## Testing Design

### Unit Tests

- Test each adapter independently
- Mock page objects
- Test normalization logic
- Test error handling

### Integration Tests

- Test factory routing
- Test adapter creation
- Test end-to-end flow

### Coverage Target

- Minimum 70%
- Focus on critical paths
- Test edge cases

## Deployment Design

### Container

- Docker-based
- Node.js 20 base image
- Playwright Chrome included

### Configuration

- Environment variables
- Apify input schema
- No hardcoded values

### Monitoring

- Structured logs
- Apify platform metrics
- Error tracking

## Future Design Considerations

### Phase 2

- Deduplication service
- Change detection
- Notification system

### Phase 3

- AI integration
- Recommendation engine
- Analytics dashboard

## Design Trade-offs

### Chosen: Adapter Pattern

**Pros**: Easy to extend, isolated logic, testable  
**Cons**: More files, slight overhead  
**Decision**: Benefits outweigh costs

### Chosen: Dual Extraction (JS + DOM)

**Pros**: Reliable, handles site changes  
**Cons**: More code, slower fallback  
**Decision**: Reliability is critical

### Chosen: Unified Schema

**Pros**: Consistent output, easy analysis  
**Cons**: May lose site-specific data  
**Decision**: Consistency more valuable

## Design Review

**Reviewed By**: [Architect]  
**Date**: 2024-12-04  
**Status**: ✅ Approved  
**Version**: 1.0.0
