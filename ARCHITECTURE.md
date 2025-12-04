# Architecture - Job Aggregator

## Design Pattern: Adapter Pattern

The Job Aggregator uses the **Adapter Pattern** to provide a unified interface for scraping multiple job sites.

```
┌─────────────┐
│   User      │
│   Input     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Adapter Factory │ ◄── Detects site from URL
└────────┬────────┘
         │
    ┌────┴────┬────────┬─────────┐
    ▼         ▼        ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│LinkedIn│ │Indeed  │ │Glass-  │ │Future  │
│Adapter │ │Adapter │ │door    │ │Sites   │
└────┬───┘ └───┬────┘ └───┬────┘ └────────┘
     │         │           │
     └─────────┴───────────┘
               │
               ▼
     ┌──────────────────┐
     │  Unified Schema  │
     │  (Job Object)    │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │  Output Dataset  │
     └──────────────────┘
```

## Core Components

### 1. Base Adapter (`base-adapter.js`)

Abstract class defining the interface all adapters must implement.

**Key Methods**:

- `isValidUrl(url)` - Validates if URL belongs to this site
- `buildSearchUrl(query, location, page)` - Builds search URLs
- `extractFromJavaScript(page)` - Extracts from window objects
- `extractFromDOM(page)` - Extracts from HTML/DOM
- `normalizeData(rawData)` - Converts to unified schema

### 2. Adapter Factory (`adapter-factory.js`)

Routes requests to the correct adapter based on URL or site name.

**Responsibilities**:

- Site detection from URLs
- Adapter instantiation
- Supported sites registry

### 3. Site Adapters

Each site has its own adapter implementing the base interface.

**Current Adapters**:

- `linkedin-adapter.js` - LinkedIn Jobs
- `indeed-adapter.js` - Indeed
- `glassdoor-adapter.js` - Glassdoor

### 4. Unified Schema (`field-mapping.js`)

Defines the common output format for all job sites.

**Core Fields**:

```javascript
{
  id: string,
  url: string,
  source: 'linkedin' | 'indeed' | 'glassdoor',
  title: string,
  company: string,
  location: string,
  salary: { min, max, currency, period },
  description: string,
  jobType: string,
  postedDate: string,
  _scrapedAt: string
}
```

### 5. Main Orchestrator (`main.js`)

Coordinates the scraping process using Crawlee and Apify SDK.

**Flow**:

1. Load input configuration
2. Generate URLs (from startUrls or searchQueries)
3. Create crawler with proxy support
4. For each URL:
   - Detect site and create adapter
   - Extract jobs (JS → DOM fallback)
   - Normalize to unified schema
   - Validate required fields
   - Save to dataset
   - Handle pagination

## Data Flow

```
Input URLs
    ↓
Adapter Factory (site detection)
    ↓
Site Adapter
    ↓
JavaScript Extraction (try first)
    ↓ (if fails)
DOM Extraction (fallback)
    ↓
Raw Site Data
    ↓
normalizeData()
    ↓
Unified Schema
    ↓
Field Validation
    ↓
Dataset Storage
```

## Extraction Strategy

### Two-Phase Extraction

**Phase 1: JavaScript Extraction**

- Fastest and most reliable
- Looks for: `window.__DATA__`, `window.__APOLLO_STATE__`, JSON-LD
- Returns structured data directly

**Phase 2: DOM Extraction (Fallback)**

- Used when JS extraction fails
- Queries DOM selectors
- More fragile but works when JS data unavailable

### Example: LinkedIn

```javascript
// Phase 1: Try JavaScript
const jsData = await page.evaluate(() => {
  const script = document.querySelector('script[type="application/ld+json"]');
  return script ? JSON.parse(script.textContent) : null;
});

// Phase 2: Fallback to DOM
if (!jsData) {
  const domData = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".job-card")).map((card) => ({
      title: card.querySelector(".title")?.textContent,
      company: card.querySelector(".company")?.textContent,
    }));
  });
}
```

## Benefits of This Architecture

### 1. **Separation of Concerns**

- Each adapter handles ONE site
- Easy to debug and maintain
- Changes to one site don't affect others

### 2. **Easy to Extend**

Adding a new site takes ~1 hour:

```javascript
// 1. Create adapter
class MonsterAdapter extends BaseAdapter { ... }

// 2. Register in factory
case 'monster': return new MonsterAdapter(config);

// Done!
```

### 3. **Consistent Output**

All sites output the same schema, making data analysis easy.

### 4. **Testable**

Each adapter can be unit tested independently.

### 5. **Resilient**

- JavaScript → DOM fallback
- Proxy support
- Error handling per adapter

## Error Handling

```javascript
try {
  const adapter = AdapterFactory.createAdapter(url);
  const jobs = await adapter.extractFromDOM(page);

  for (const job of jobs) {
    const normalized = adapter.normalizeData(job);

    // Validate required fields
    if (!normalized.id || !normalized.title) {
      log.warn("Skipping invalid job");
      continue;
    }

    await Actor.pushData(normalized);
  }
} catch (error) {
  log.error(`Failed to process ${url}`, error);
  // Continue with next URL
}
```

## Performance Considerations

### Concurrency

Crawlee handles concurrent requests automatically with smart rate limiting.

### Proxy Rotation

```javascript
const proxyConfig = await Actor.createProxyConfiguration({
  groups: ["RESIDENTIAL"],
  countryCode: "US",
});
```

### Memory Management

- Stream results to dataset (don't store in memory)
- Limit maxRequestsPerCrawl
- Use pagination wisely

## Future Enhancements

### 1. Job Detail Scraping

Currently scrapes listing pages. Could add:

- Full job descriptions
- Company details
- Application requirements

### 2. Deduplication

Track jobs across sites:

```javascript
{
  id: 'unified-123',
  sources: ['linkedin', 'indeed'],
  _isDuplicate: true
}
```

### 3. Change Detection

Monitor jobs over time:

- Price changes
- New postings
- Closed positions

### 4. AI Enhancement

- Categorize jobs by skill level
- Extract required skills
- Salary prediction

## Testing Strategy

### Unit Tests

Test each adapter independently:

```javascript
describe("LinkedInAdapter", () => {
  test("should normalize salary correctly", () => {
    const result = adapter._parseSalary("$100K - $150K");
    expect(result.min).toBe(100000);
  });
});
```

### Integration Tests

Test adapter factory routing:

```javascript
test("should create correct adapter from URL", () => {
  const adapter = AdapterFactory.createAdapter("https://linkedin.com/jobs");
  expect(adapter).toBeInstanceOf(LinkedInAdapter);
});
```

### Coverage Target

- Minimum 70% code coverage
- Focus on adapter logic and normalization

## Deployment

### Local Development

```bash
npm start
```

### Apify Platform

```bash
apify push
```

### Scheduled Runs

Configure in Apify Console:

- Daily job scraping
- Weekly market analysis
- Real-time alerts

## Maintenance

### When Sites Change

1. Update specific adapter's selectors
2. Test with `npm test`
3. Deploy updated version
4. Other adapters unaffected ✅

### Adding Features

1. Update unified schema in `field-mapping.js`
2. Update all adapters to extract new field
3. Backward compatible (new fields optional)

## Conclusion

This architecture provides:

- ✅ Fast development (4-7 hours vs 9-15 days)
- ✅ Easy maintenance (isolated adapters)
- ✅ Scalability (add sites in ~1 hour)
- ✅ Reliability (fallback strategies)
- ✅ Consistency (unified output)

**Time Savings: 95%** compared to building from scratch!
