# Design Specification - Multi-Platform Job Aggregator

## Design Overview

**Architecture Pattern**: Adapter Pattern + Pipeline Pattern  
**Design Philosophy**: Separation of Concerns, DRY, SOLID Principles  
**Status**: 🔄 Enhanced (v1.1)  
**Version**: 1.1.0 - Adding duplicate detection, expiration filtering, and advanced search

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
│                  Post-Processing Pipeline                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  1. Duplicate Detection                               │ │
│  │     - Generate job fingerprints                       │ │
│  │     - Compare and mark duplicates                     │ │
│  │     - Track sources across platforms                  │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  2. Expiration Detection                              │ │
│  │     - Calculate job age                               │ │
│  │     - Mark expired jobs                               │ │
│  │     - Apply age filters                               │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  3. Filtering                                         │ │
│  │     - Remove duplicates (if enabled)                  │ │
│  │     - Exclude expired jobs (if enabled)               │ │
│  │     - Apply job age filters                           │ │
│  └───────────────────────────────────────────────────────┘ │
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
  _site: string,                 // Source site name

  // Duplicate detection (added in v1.1)
  _isDuplicate: boolean,         // Is this a duplicate job?
  _duplicateOf: string | null,   // ID of original job if duplicate
  _fingerprint: string,          // Hash for duplicate detection
  sources: Array<string>,        // All platforms with this job

  // Expiration detection (added in v1.1)
  _isExpired: boolean,           // Is this job expired?
  _ageInDays: number | null      // Age in days since posted
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
   ├─ Validate platforms selection
   ├─ Validate search mode
   ├─ Validate job age filter
   └─ Validate other parameters
   ↓
3. Apply Platform Filter
   ├─ Filter selected platforms
   └─ Skip unselected platforms
   ↓
4. Generate URLs
   ├─ From startUrls (direct)
   └─ From searchQueries (generate for selected platforms)
   ├─ Apply search mode (exact vs similar)
   └─ Apply job age filter to URLs
   ↓
5. Initialize Crawler
   ├─ Configure proxies
   ├─ Set concurrency
   └─ Set limits
   ↓
6. For Each URL:
   ├─ Detect site
   ├─ Create adapter
   ├─ Extract data (JS → DOM fallback)
   ├─ Normalize data
   ├─ Validate required fields
   ├─ Save to temporary storage
   └─ Handle pagination
   ↓
7. Post-Processing Pipeline
   ├─ Load all scraped jobs
   ├─ Detect duplicates
   │  ├─ Generate fingerprints
   │  ├─ Mark duplicates
   │  └─ Track sources
   ├─ Detect expiration
   │  ├─ Calculate job age
   │  └─ Mark expired jobs
   └─ Apply filters
      ├─ Remove duplicates (if enabled)
      ├─ Exclude expired (if enabled)
      └─ Filter by job age
   ↓
8. Save to Dataset
   ↓
9. Complete
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

### 6. Duplicate Detection Service

**Purpose**: Identify and mark duplicate job listings across platforms

**Algorithm**:

```javascript
class DuplicateDetector {
  generateFingerprint(job): string {
    // Normalize and hash key fields
    const normalized = {
      title: this.normalizeTitle(job.title),
      company: this.normalizeCompany(job.company),
      location: this.normalizeLocation(job.location),
    };
    return crypto
      .createHash("md5")
      .update(JSON.stringify(normalized))
      .digest("hex");
  }

  normalizeTitle(title): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
  }

  normalizeCompany(company): string {
    return company
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
  }

  normalizeLocation(location): string {
    return location
      .toLowerCase()
      .replace(/[^a-z0-9\s,]/g, "")
      .trim();
  }

  detectDuplicates(jobs): Array<Object> {
    const fingerprints = new Map();
    const results = [];

    for (const job of jobs) {
      const fingerprint = this.generateFingerprint(job);

      if (fingerprints.has(fingerprint)) {
        // Duplicate found
        const original = fingerprints.get(fingerprint);
        job._isDuplicate = true;
        job._duplicateOf = original.id;
        job._fingerprint = fingerprint;

        // Add source to original's sources array
        if (!original.sources) {
          original.sources = [original.source];
        }
        if (!original.sources.includes(job.source)) {
          original.sources.push(job.source);
        }
      } else {
        // First occurrence
        job._isDuplicate = false;
        job._fingerprint = fingerprint;
        job.sources = [job.source];
        fingerprints.set(fingerprint, job);
      }

      results.push(job);
    }

    return results;
  }

  removeDuplicates(jobs): Array<Object> {
    return jobs.filter((job) => !job._isDuplicate);
  }
}
```

**Design Decisions**:

- ✅ MD5 hash for fingerprints (fast, collision-resistant for this use case)
- ✅ Normalize text to handle variations (case, punctuation, company suffixes)
- ✅ Track all sources where job appears
- ✅ Keep first occurrence as "original"
- ✅ Optional removal of duplicates

### 7. Expiration Detection Service

**Purpose**: Identify expired jobs and calculate job age

**Algorithm**:

```javascript
class ExpirationDetector {
  calculateAge(postedDate): number | null {
    if (!postedDate) return null;

    const posted = new Date(postedDate);
    const now = new Date();
    const ageMs = now - posted;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    return ageDays;
  }

  isExpired(job, expirationDays = 30): boolean {
    const age = this.calculateAge(job.postedDate);
    if (age === null) return false; // Unknown age = not expired
    return age > expirationDays;
  }

  markExpiration(jobs, expirationDays = 30): Array<Object> {
    return jobs.map((job) => ({
      ...job,
      _ageInDays: this.calculateAge(job.postedDate),
      _isExpired: this.isExpired(job, expirationDays),
    }));
  }

  filterExpired(jobs): Array<Object> {
    return jobs.filter((job) => !job._isExpired);
  }

  filterByAge(jobs, maxAgeDays): Array<Object> {
    if (!maxAgeDays) return jobs;

    return jobs.filter((job) => {
      if (job._ageInDays === null) return true; // Include unknown age
      return job._ageInDays <= maxAgeDays;
    });
  }
}
```

**Age Filter Mapping**:

```javascript
const AGE_FILTERS = {
  "24h": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  any: null,
};
```

**Design Decisions**:

- ✅ Jobs with missing posted dates are not marked as expired
- ✅ Age calculated in days (integer)
- ✅ Configurable expiration threshold
- ✅ Separate filtering for expired vs age-based

### 8. Search Mode Handler

**Purpose**: Adapt search queries for exact vs similar matching

**Implementation**:

```javascript
class SearchModeHandler {
  buildSearchQuery(keywords, mode = "similar"): string {
    if (mode === "exact") {
      return `"${keywords}"`;
    }
    return keywords;
  }

  adaptForPlatform(keywords, mode, platform): Object {
    const handlers = {
      linkedin: this.linkedInHandler,
      indeed: this.indeedHandler,
      glassdoor: this.glassdoorHandler,
    };

    return handlers[platform](keywords, mode);
  }

  linkedInHandler(keywords, mode): Object {
    return {
      keywords: mode === "exact" ? `"${keywords}"` : keywords,
      urlParam: "keywords",
    };
  }

  indeedHandler(keywords, mode): Object {
    if (mode === "exact") {
      return {
        keywords: keywords,
        urlParam: "q",
        additionalParams: { jt: "exactphrase" },
      };
    }
    return {
      keywords: keywords,
      urlParam: "q",
    };
  }

  glassdoorHandler(keywords, mode): Object {
    return {
      keywords: mode === "exact" ? `"${keywords}"` : keywords,
      urlParam: "keyword",
    };
  }
}
```

**Design Decisions**:

- ✅ Platform-specific handling (different sites use different mechanisms)
- ✅ Default to similar search (broader results)
- ✅ Exact mode uses quotes or platform-specific parameters

### 9. Platform Filter

**Purpose**: Filter which platforms to search

**Implementation**:

```javascript
class PlatformFilter {
  constructor(selectedPlatforms = ["linkedin", "indeed", "glassdoor"]) {
    this.selectedPlatforms = selectedPlatforms.map((p) => p.toLowerCase());
    this.allPlatforms = ["linkedin", "indeed", "glassdoor"];
  }

  isEnabled(platform): boolean {
    return this.selectedPlatforms.includes(platform.toLowerCase());
  }

  filterUrls(urls): Array<string> {
    return urls.filter((url) => {
      const platform = this.detectPlatform(url);
      return this.isEnabled(platform);
    });
  }

  detectPlatform(url): string {
    const urlLower = url.toLowerCase();
    if (urlLower.includes("linkedin.com")) return "linkedin";
    if (urlLower.includes("indeed.com")) return "indeed";
    if (urlLower.includes("glassdoor.com")) return "glassdoor";
    return "unknown";
  }

  getEnabledPlatforms(): Array<string> {
    return this.selectedPlatforms;
  }
}
```

**Design Decisions**:

- ✅ Case-insensitive platform names
- ✅ Default to all platforms
- ✅ Filter URLs before processing
- ✅ Easy to validate platform names

### 10. Job Age Filter

**Purpose**: Apply platform-specific age filters to search URLs

**Implementation**:

```javascript
class JobAgeFilter {
  constructor(ageFilter = "any") {
    this.ageFilter = ageFilter;
    this.ageDays = this.parseAgeFilter(ageFilter);
  }

  parseAgeFilter(filter): number | null {
    const mapping = {
      "24h": 1,
      "7d": 7,
      "14d": 14,
      "30d": 30,
      any: null,
    };
    return mapping[filter] || null;
  }

  applyToUrl(url, platform): string {
    if (!this.ageDays) return url;

    const handlers = {
      linkedin: this.applyLinkedIn,
      indeed: this.applyIndeed,
      glassdoor: this.applyGlassdoor,
    };

    const handler = handlers[platform];
    return handler ? handler.call(this, url) : url;
  }

  applyLinkedIn(url): string {
    // LinkedIn uses f_TPR parameter
    // r86400 = 24h, r604800 = 7d, r1209600 = 14d, r2592000 = 30d
    const mapping = {
      1: "r86400",
      7: "r604800",
      14: "r1209600",
      30: "r2592000",
    };

    const urlObj = new URL(url);
    urlObj.searchParams.set("f_TPR", mapping[this.ageDays]);
    return urlObj.toString();
  }

  applyIndeed(url): string {
    // Indeed uses fromage parameter (days)
    const urlObj = new URL(url);
    urlObj.searchParams.set("fromage", this.ageDays.toString());
    return urlObj.toString();
  }

  applyGlassdoor(url): string {
    // Glassdoor uses fromAge parameter (days)
    const urlObj = new URL(url);
    urlObj.searchParams.set("fromAge", this.ageDays.toString());
    return urlObj.toString();
  }
}
```

**Design Decisions**:

- ✅ Platform-specific URL parameter handling
- ✅ Apply filter at URL generation time (server-side filtering)
- ✅ Fallback to client-side filtering if platform doesn't support
- ✅ Configurable age thresholds

### 11. Utilities

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

**Existing Tests**:

- Test each adapter independently
- Mock page objects
- Test normalization logic
- Test error handling

**New Tests for v1.1**:

- Test duplicate detection fingerprint generation
- Test expiration calculation logic
- Test search mode URL generation
- Test platform filtering
- Test job age filtering

### Property-Based Tests

**Testing Framework**: fast-check (JavaScript property-based testing library)

**Test Configuration**: Minimum 100 iterations per property test

**Property Tests to Implement**:

1. **Duplicate Detection Property Test**

   - Generate random job listings with controlled duplicates
   - Verify duplicate detection marks correct jobs
   - Verify sources array aggregation
   - **Tag**: `Feature: job-aggregator-enhancements, Property 1: Duplicate Detection Consistency`

2. **Duplicate Removal Property Test**

   - Generate random job sets with duplicates
   - Apply removal filter
   - Verify no duplicates remain
   - **Tag**: `Feature: job-aggregator-enhancements, Property 2: Duplicate Removal Completeness`

3. **Expiration Detection Property Test**

   - Generate random jobs with various posted dates
   - Test with different expiration thresholds
   - Verify age calculation and expiration marking
   - **Tag**: `Feature: job-aggregator-enhancements, Property 3: Expiration Detection Accuracy`

4. **Expired Job Filtering Property Test**

   - Generate random job sets with expired jobs
   - Apply filter
   - Verify only non-expired jobs remain
   - **Tag**: `Feature: job-aggregator-enhancements, Property 4: Expired Job Filtering`

5. **Search Mode URL Generation Property Test**

   - Generate random keywords and platforms
   - Test both exact and similar modes
   - Verify URL contains correct parameters
   - **Tag**: `Feature: job-aggregator-enhancements, Property 5 & 6: Search Mode URL Generation`

6. **Job Age Filtering Property Test**

   - Generate random jobs with various ages
   - Test with different age thresholds
   - Verify filtering accuracy
   - **Tag**: `Feature: job-aggregator-enhancements, Property 7: Job Age Filtering Accuracy`

7. **Platform Selection Property Test**

   - Generate random platform selections
   - Verify only selected platforms generate URLs
   - **Tag**: `Feature: job-aggregator-enhancements, Property 8: Platform Selection Filtering`

8. **Schema Consistency Property Test**
   - Generate random input configurations
   - Verify all outputs conform to schema
   - **Tag**: `Feature: job-aggregator-enhancements, Property 9: Output Schema Consistency`

### Integration Tests

- Test factory routing
- Test adapter creation
- Test end-to-end flow with new filters
- Test post-processing pipeline
- Test quick vs power search modes

### Edge Cases

- Jobs with missing posted dates (should not be marked expired)
- Empty job sets (should handle gracefully)
- Single job (no duplicates possible)
- All jobs expired (filter should return empty)
- Invalid platform names (should validate and reject)

### Coverage Target

- Minimum 70%
- Focus on critical paths
- Test edge cases
- Property tests cover broad input space

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

### Phase 2 (Completed in v1.1)

- ✅ Deduplication service
- ⬜ Change detection
- ⬜ Notification system

### Phase 3

- ⬜ AI integration for better duplicate detection
- ⬜ Fuzzy matching for similar jobs
- ⬜ Recommendation engine
- ⬜ Analytics dashboard
- ⬜ Salary prediction
- ⬜ Skills extraction

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Duplicate Detection Consistency

_For any_ set of job listings, jobs with identical normalized title, company, and location should be marked as duplicates, with the first occurrence preserved as the original and subsequent occurrences marked with `_isDuplicate: true`, `_duplicateOf` pointing to the original ID, and all platforms tracked in the `sources` array.

**Validates: Requirements BR-6.1, BR-6.2, BR-6.4, BR-6.5**

### Property 2: Duplicate Removal Completeness

_For any_ set of jobs with duplicates marked, applying the duplicate removal filter should result in a set containing only jobs where `_isDuplicate` is false.

**Validates: Requirements BR-6.3**

### Property 3: Expiration Detection Accuracy

_For any_ job with a posted date and expiration threshold, the job should be marked as `_isExpired: true` if and only if the calculated age in days exceeds the threshold, and `_ageInDays` should accurately reflect the number of days since posting.

**Validates: Requirements BR-7.1, BR-7.2, BR-7.4, BR-7.5**

### Property 4: Expired Job Filtering

_For any_ set of jobs with expiration marked, applying the expired job filter should result in a set containing only jobs where `_isExpired` is false.

**Validates: Requirements BR-7.3**

### Property 5: Exact Search Mode URL Generation

_For any_ search keywords and platform, when search mode is "exact", the generated search URL should include platform-specific exact match indicators (quotes for LinkedIn/Glassdoor, exactphrase parameter for Indeed).

**Validates: Requirements BR-8.1**

### Property 6: Similar Search Mode URL Generation

_For any_ search keywords and platform, when search mode is "similar", the generated search URL should not include exact match constraints.

**Validates: Requirements BR-8.2**

### Property 7: Job Age Filtering Accuracy

_For any_ set of jobs with age calculated and a maximum age threshold, applying the age filter should result in a set containing only jobs where `_ageInDays` is null (unknown age) or `_ageInDays <= maxAge`.

**Validates: Requirements BR-9.1, BR-9.3**

### Property 8: Platform Selection Filtering

_For any_ set of selected platforms and search queries, the generated URLs should only include URLs for the selected platforms, and no URLs for unselected platforms.

**Validates: Requirements BR-10.1, BR-10.3, BR-10.5**

### Property 9: Output Schema Consistency

_For any_ input configuration (quick search or power search mode), all output jobs should conform to the unified job schema with all required fields present and correctly typed.

**Validates: Requirements BR-11.5**

### Property 10: Fingerprint Uniqueness for Distinct Jobs

_For any_ two jobs with different normalized title, company, or location, their generated fingerprints should be different.

**Validates: Requirements BR-6.1** (inverse property for validation)

### Property 11: Age Calculation Monotonicity

_For any_ job with a posted date, if the current time advances, the calculated `_ageInDays` should never decrease.

**Validates: Requirements BR-7.4** (temporal consistency)

## Input Schema Design

### Quick Search Mode

**Purpose**: Simple interface for basic job searches

**Input Parameters**:

```javascript
{
  // Required
  searchQueries: Array<{
    query: string,      // Job title/keywords
    location: string    // Job location
  }>,

  // Optional (with defaults)
  platforms: ['linkedin', 'indeed', 'glassdoor'],  // All platforms
  maxPages: 5,
  maxItems: 100,

  // Quick search uses these defaults:
  searchMode: 'similar',
  jobAge: 'any',
  excludeExpired: false,
  removeDuplicates: false,
  expirationDays: 30
}
```

### Power Search Mode

**Purpose**: Advanced interface with all filtering options

**Input Parameters**:

```javascript
{
  // Required
  searchQueries: Array<{
    query: string,
    location: string
  }>,

  // Platform selection
  platforms: Array<'linkedin' | 'indeed' | 'glassdoor'>,

  // Search configuration
  searchMode: 'exact' | 'similar',
  jobAge: '24h' | '7d' | '14d' | '30d' | 'any',

  // Filtering options
  excludeExpired: boolean,
  removeDuplicates: boolean,
  expirationDays: number,

  // Pagination
  maxPages: number,
  maxItems: number,

  // Advanced options
  proxyConfiguration: Object,
  maxConcurrency: number
}
```

### Input Validation Rules

```javascript
{
  platforms: {
    type: 'array',
    items: { enum: ['linkedin', 'indeed', 'glassdoor'] },
    default: ['linkedin', 'indeed', 'glassdoor']
  },
  searchMode: {
    type: 'string',
    enum: ['exact', 'similar'],
    default: 'similar'
  },
  jobAge: {
    type: 'string',
    enum: ['24h', '7d', '14d', '30d', 'any'],
    default: 'any'
  },
  excludeExpired: {
    type: 'boolean',
    default: false
  },
  removeDuplicates: {
    type: 'boolean',
    default: false
  },
  expirationDays: {
    type: 'number',
    minimum: 1,
    maximum: 365,
    default: 30
  }
}
```

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

### Chosen: Post-Processing Pipeline

**Pros**: Clean separation, can process all jobs together, easier duplicate detection  
**Cons**: Requires temporary storage, adds processing step  
**Decision**: Duplicate detection requires comparing all jobs, so post-processing is necessary

### Chosen: Fingerprint-Based Duplicate Detection

**Pros**: Fast, deterministic, handles variations in text  
**Cons**: May miss some duplicates if text differs significantly, may false-positive on similar jobs  
**Decision**: Normalization reduces false positives, speed is important for large datasets

### Chosen: Client-Side Age Filtering + Server-Side Where Supported

**Pros**: Works for all platforms, leverages platform filtering when available  
**Cons**: May fetch jobs that will be filtered out  
**Decision**: Hybrid approach balances reliability and efficiency

### Chosen: Optional Filtering (Default: Keep All)

**Pros**: Users see all data by default, can choose to filter  
**Cons**: May return duplicate/expired jobs if user doesn't enable filters  
**Decision**: Transparency is valuable, users can decide what to filter

## Design Review

**Reviewed By**: [Architect]  
**Date**: 2024-12-04  
**Status**: 🔄 Enhanced  
**Version**: 1.1.0 - Duplicate Detection, Expiration Filtering, Advanced Search

**Changes in v1.1**:

- Added post-processing pipeline for duplicate detection and expiration filtering
- Added 5 new service components (DuplicateDetector, ExpirationDetector, SearchModeHandler, PlatformFilter, JobAgeFilter)
- Extended unified schema with 7 new fields
- Added 11 correctness properties
- Added property-based testing strategy
- Enhanced input schema with 7 new parameters
- Updated main orchestrator flow with post-processing steps
