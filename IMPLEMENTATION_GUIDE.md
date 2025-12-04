# Implementation Guide - Job Aggregator

Step-by-step guide for understanding and extending the Job Aggregator.

## Project Structure

```
job-aggregator/
├── .actor/
│   └── actor.json              # Apify configuration & input schema
├── __tests__/
│   ├── adapter-factory.test.js # Factory tests
│   └── linkedin-adapter.test.js # Adapter tests
├── src/
│   ├── adapters/
│   │   ├── base-adapter.js     # Abstract base class
│   │   ├── adapter-factory.js  # Site routing
│   │   ├── linkedin-adapter.js # LinkedIn implementation
│   │   ├── indeed-adapter.js   # Indeed implementation
│   │   └── glassdoor-adapter.js # Glassdoor implementation
│   ├── utils/
│   │   ├── logger.js           # Structured logging
│   │   └── field-mapping.js    # Unified schema
│   └── main.js                 # Entry point & orchestration
├── Dockerfile                  # Container configuration
├── package.json                # Dependencies
├── jest.config.js              # Test configuration
├── README.md                   # Overview
├── QUICK_START.md              # Getting started
├── ARCHITECTURE.md             # Design patterns
└── IMPLEMENTATION_GUIDE.md     # This file
```

## Understanding the Code

### 1. Entry Point: `main.js`

The main orchestrator that:

- Loads input configuration
- Creates crawler with Playwright
- Routes URLs to correct adapters
- Handles pagination
- Saves results

**Key Code**:

```javascript
// Detect site and create adapter
const adapter = AdapterFactory.createAdapter(url);

// Extract jobs (JS first, DOM fallback)
const jsData = await adapter.extractFromJavaScript(page);
const jobs = jsData || (await adapter.extractFromDOM(page));

// Normalize and save
for (const job of jobs) {
  const normalized = adapter.normalizeData(job);
  await Actor.pushData(normalized);
}
```

### 2. Adapter Factory: `adapter-factory.js`

Routes requests to the correct adapter.

**Site Detection**:

```javascript
static _detectSite(siteNameOrUrl) {
  if (url.hostname.includes('linkedin.com')) return 'linkedin';
  if (url.hostname.includes('indeed.com')) return 'indeed';
  if (url.hostname.includes('glassdoor.com')) return 'glassdoor';
}
```

### 3. Base Adapter: `base-adapter.js`

Defines the contract all adapters must follow.

**Required Methods**:

- `isValidUrl(url)` - URL validation
- `buildSearchUrl(query, location, page)` - Search URL generation
- `buildPageUrl(baseUrl, page)` - Pagination
- `extractFromJavaScript(page)` - JS extraction
- `extractFromDOM(page)` - DOM extraction
- `normalizeData(rawData)` - Schema normalization

### 4. Site Adapters

Each implements the base adapter for a specific site.

**Example: LinkedIn Adapter**

```javascript
class LinkedInAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.siteName = "linkedin";
  }

  isValidUrl(url) {
    return /linkedin\.com/i.test(url);
  }

  async extractFromDOM(page) {
    return await page.evaluate(() => {
      // Site-specific DOM queries
      return Array.from(document.querySelectorAll(".job-card")).map((card) => ({
        title: card.querySelector(".title")?.textContent,
        company: card.querySelector(".company")?.textContent,
      }));
    });
  }

  normalizeData(rawData) {
    // Convert to unified schema
    return {
      id: rawData.id,
      source: "linkedin",
      title: rawData.title,
      // ... other fields
    };
  }
}
```

## Adding a New Job Site

Let's add **Monster.com** as an example.

### Step 1: Create Adapter File

Create `src/adapters/monster-adapter.js`:

```javascript
const BaseAdapter = require("./base-adapter");

class MonsterAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.siteName = "monster";
    this.sitePattern = /monster\.com/i;
  }

  isValidUrl(url) {
    return this.sitePattern.test(url);
  }

  buildSearchUrl(query, location, pageNumber = 0) {
    const params = new URLSearchParams({
      q: query,
      where: location || "",
      page: pageNumber + 1,
    });
    return `https://www.monster.com/jobs/search/?${params.toString()}`;
  }

  buildPageUrl(baseUrl, pageNumber) {
    const url = new URL(baseUrl);
    url.searchParams.set("page", pageNumber + 1);
    return url.toString();
  }

  async extractFromJavaScript(page) {
    return await page.evaluate(() => {
      // Check for Monster's data structure
      if (window.__INITIAL_STATE__) {
        return window.__INITIAL_STATE__.jobs;
      }
      return null;
    });
  }

  async extractFromDOM(page) {
    return await page.evaluate(() => {
      const jobs = [];
      const jobCards = document.querySelectorAll(".job-card");

      jobCards.forEach((card) => {
        jobs.push({
          id: card.getAttribute("data-job-id"),
          title: card.querySelector(".job-title")?.textContent?.trim(),
          company: card.querySelector(".company-name")?.textContent?.trim(),
          location: card.querySelector(".location")?.textContent?.trim(),
          salary: card.querySelector(".salary")?.textContent?.trim(),
          url: card.querySelector("a")?.href,
        });
      });

      return jobs;
    });
  }

  async extractFullDetails(page) {
    return await page.evaluate(() => {
      return {
        description: document.querySelector(".job-description")?.textContent,
        requirements: Array.from(
          document.querySelectorAll(".requirements li")
        ).map((el) => el.textContent?.trim()),
      };
    });
  }

  normalizeData(rawData) {
    const salary = this._parseSalary(rawData.salary);

    return {
      id: rawData.id || this._generateId(rawData.url),
      url: rawData.url,
      source: "monster",
      title: rawData.title,
      company: rawData.company,
      location: rawData.location || "Not specified",
      salary: {
        min: salary.min,
        max: salary.max,
        currency: salary.currency,
        period: salary.period,
      },
      description: rawData.description || "",
      requirements: rawData.requirements || [],
      benefits: [],
      jobType: null,
      experienceLevel: null,
      postedDate: new Date().toISOString(),
      applicantCount: null,
      companyLogo: null,
      companyRating: null,
      _scrapedAt: new Date().toISOString(),
      _site: this.siteName,
    };
  }

  _parseSalary(salaryText) {
    if (!salaryText)
      return { min: null, max: null, currency: null, period: null };

    const match = salaryText.match(/\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/);
    if (!match) return { min: null, max: null, currency: null, period: null };

    return {
      min: match[1] ? parseInt(match[1].replace(/,/g, "")) : null,
      max: match[2] ? parseInt(match[2].replace(/,/g, "")) : null,
      currency: "USD",
      period: "year",
    };
  }

  _generateId(url) {
    return url?.split("/").pop() || `monster-${Date.now()}`;
  }
}

module.exports = MonsterAdapter;
```

### Step 2: Register in Factory

Update `src/adapters/adapter-factory.js`:

```javascript
// Add import
const MonsterAdapter = require('./monster-adapter');

// Add to createAdapter switch
case 'monster':
  return new MonsterAdapter(config);

// Add to _detectSite
if (hostname.includes('monster.com')) return 'monster';

// Add to site name normalization
if (lower === 'monster') return 'monster';

// Add to getSupportedSites
return ['linkedin', 'indeed', 'glassdoor', 'monster'];
```

### Step 3: Write Tests

Create `__tests__/monster-adapter.test.js`:

```javascript
const MonsterAdapter = require("../src/adapters/monster-adapter");

describe("MonsterAdapter", () => {
  let adapter;

  beforeEach(() => {
    adapter = new MonsterAdapter();
  });

  test("should validate Monster URLs", () => {
    expect(adapter.isValidUrl("https://www.monster.com/jobs/search")).toBe(
      true
    );
  });

  test("should build search URL", () => {
    const url = adapter.buildSearchUrl("developer", "NYC");
    expect(url).toContain("monster.com/jobs/search");
    expect(url).toContain("q=developer");
  });

  test("should normalize data", () => {
    const rawData = {
      id: "123",
      title: "Developer",
      company: "Tech Co",
      url: "https://monster.com/job/123",
    };

    const normalized = adapter.normalizeData(rawData);
    expect(normalized.source).toBe("monster");
    expect(normalized._site).toBe("monster");
  });
});
```

### Step 4: Test

```bash
npm test
```

### Step 5: Done! 🎉

Monster.com is now supported. Total time: ~1 hour.

## Common Patterns

### Pattern 1: Salary Parsing

```javascript
_parseSalary(salaryText) {
  if (!salaryText) return { min: null, max: null, currency: null, period: null };

  // Match: $100,000 - $150,000
  const match = salaryText.match(/\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/);
  if (!match) return { min: null, max: null, currency: null, period: null };

  // Detect period
  let period = 'year';
  if (salaryText.toLowerCase().includes('hour')) period = 'hour';
  if (salaryText.toLowerCase().includes('month')) period = 'month';

  return {
    min: match[1] ? parseInt(match[1].replace(/,/g, '')) : null,
    max: match[2] ? parseInt(match[2].replace(/,/g, '')) : null,
    currency: 'USD',
    period
  };
}
```

### Pattern 2: Date Parsing

```javascript
_parseDate(dateText) {
  if (!dateText) return new Date().toISOString();

  // "Posted 2 days ago"
  const daysMatch = dateText.match(/(\d+)\s+days?\s+ago/i);
  if (daysMatch) {
    const date = new Date();
    date.setDate(date.getDate() - parseInt(daysMatch[1]));
    return date.toISOString();
  }

  // "Posted today"
  if (/today/i.test(dateText)) {
    return new Date().toISOString();
  }

  return new Date().toISOString();
}
```

### Pattern 3: Job Type Normalization

```javascript
_normalizeJobType(jobType) {
  if (!jobType) return null;

  const lower = jobType.toLowerCase();
  if (lower.includes('full')) return 'full-time';
  if (lower.includes('part')) return 'part-time';
  if (lower.includes('contract')) return 'contract';
  if (lower.includes('intern')) return 'internship';
  if (lower.includes('temporary')) return 'temporary';

  return null;
}
```

### Pattern 4: Retry Logic

```javascript
async retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = 1000 * (i + 1); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Debugging Tips

### 1. Test Extraction Locally

```javascript
// In adapter file, add debug method:
async debugExtraction(url) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(url);
  await page.waitForTimeout(3000);

  const jsData = await this.extractFromJavaScript(page);
  console.log('JS Data:', jsData);

  const domData = await this.extractFromDOM(page);
  console.log('DOM Data:', domData);

  await browser.close();
}
```

### 2. Log Extraction Results

```javascript
const jobs = await adapter.extractFromDOM(page);
console.log(`Extracted ${jobs.length} jobs`);
console.log("Sample:", JSON.stringify(jobs[0], null, 2));
```

### 3. Check Selectors

Use browser DevTools to verify selectors:

```javascript
// In browser console:
document.querySelectorAll(".job-card").length;
document.querySelector(".job-title")?.textContent;
```

## Best Practices

### 1. Always Implement Both Extraction Methods

```javascript
// Try JS first (faster, more reliable)
const jsData = await adapter.extractFromJavaScript(page);

// Fallback to DOM
const jobs = jsData || (await adapter.extractFromDOM(page));
```

### 2. Handle Missing Data Gracefully

```javascript
normalizeData(rawData) {
  return {
    title: rawData.title || 'Unknown',
    company: rawData.company || 'Unknown',
    location: rawData.location || 'Not specified',
    salary: this._parseSalary(rawData.salary) // Returns nulls if missing
  };
}
```

### 3. Validate Before Saving

```javascript
const missingFields = REQUIRED_FIELDS.filter(field => !normalized[field]);
if (missingFields.length > 0) {
  log.warn(`Skipping job - missing: ${missingFields.join(', ')}`);
  continue;
}
```

### 4. Use Structured Logging

```javascript
const logger = new Logger({ adapter: "linkedin" });
logger.info("Extracting jobs", { url, pageNumber });
logger.error("Extraction failed", error, { url });
```

## Performance Optimization

### 1. Limit Concurrent Requests

```javascript
const crawler = new PlaywrightCrawler({
  maxConcurrency: 5, // Don't overwhelm sites
  maxRequestsPerCrawl: 100,
});
```

### 2. Use Proxies

```javascript
const proxyConfig = await Actor.createProxyConfiguration({
  groups: ["RESIDENTIAL"],
  countryCode: "US",
});
```

### 3. Smart Pagination

```javascript
// Stop if no new jobs found
if (jobs.length === 0) {
  log.info("No more jobs, stopping pagination");
  return;
}
```

## Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Coverage > 70% (`npm test -- --coverage`)
- [ ] README updated
- [ ] Input schema documented in actor.json
- [ ] Proxy configuration tested
- [ ] Error handling verified
- [ ] Logging implemented
- [ ] Rate limiting considered

## Next Steps

1. **Add More Sites**: Monster, ZipRecruiter, Dice
2. **Enhance Data**: Full descriptions, company details
3. **Add Features**: Deduplication, change detection
4. **Build UI**: Job board, search interface
5. **Automate**: Scheduled runs, email alerts

## Resources

- [Apify Documentation](https://docs.apify.com)
- [Crawlee Documentation](https://crawlee.dev)
- [Playwright Documentation](https://playwright.dev)
- [Jest Testing](https://jestjs.io)

## Support

Questions? Check:

- [README.md](README.md) - Overview
- [QUICK_START.md](QUICK_START.md) - Getting started
- [ARCHITECTURE.md](ARCHITECTURE.md) - Design patterns
- Adapter examples in `src/adapters/`
