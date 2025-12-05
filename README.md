# Multi-Platform Job Aggregator v1.1

Scrape jobs from LinkedIn, Indeed, and Glassdoor with a unified output schema. Perfect for job boards, market research, and recruitment automation.

## Features

### Core Features (v1.0)

- ✅ **Multi-Platform**: LinkedIn, Indeed, Glassdoor
- ✅ **Unified Schema**: Consistent output across all sources
- ✅ **Smart Extraction**: JavaScript + DOM fallback
- ✅ **Pagination Support**: Scrape multiple pages
- ✅ **Proxy Support**: Avoid rate limiting
- ✅ **Flexible Input**: URLs or search queries

### New in v1.1 🎉

- ✅ **Duplicate Detection**: Identify and remove duplicate jobs across platforms
- ✅ **Expiration Filtering**: Filter out old job postings
- ✅ **Search Modes**: Exact match or similar search
- ✅ **Job Age Filters**: Filter by posting date (24h, 7d, 14d, 30d)
- ✅ **Platform Selection**: Choose which platforms to search
- ✅ **Post-Processing Pipeline**: Advanced filtering and enrichment

## Quick Start

### Option 1: Direct URLs

```json
{
  "startUrls": [
    {
      "url": "https://www.linkedin.com/jobs/search/?keywords=software%20engineer"
    },
    { "url": "https://www.indeed.com/jobs?q=software+engineer" },
    {
      "url": "https://www.glassdoor.com/Job/jobs.htm?keyword=software+engineer"
    }
  ]
}
```

### Option 2: Search Queries (Auto-generates URLs for all platforms)

```json
{
  "searchQueries": ["software engineer", "data scientist"],
  "location": "San Francisco, CA"
}
```

## Output Schema

```javascript
{
  id: "12345",
  url: "https://...",
  source: "linkedin",
  title: "Senior Software Engineer",
  company: "Tech Corp",
  location: "San Francisco, CA",
  salary: {
    min: 120000,
    max: 180000,
    currency: "USD",
    period: "year"
  },
  description: "...",
  requirements: [],
  benefits: [],
  jobType: "full-time",
  experienceLevel: "senior",
  postedDate: "2024-12-04T...",
  applicantCount: 50,
  companyRating: 4.5,
  _scrapedAt: "2024-12-04T...",
  _site: "linkedin"
}
```

## Architecture

Built using the proven adapter pattern:

```
User Input → Adapter Factory → Site Adapter → Unified Schema → Output
```

Each site has its own adapter that handles site-specific extraction logic while outputting to a common schema.

## Development

```bash
npm install
npm start
npm test
```

## Adding New Sites

1. Create `src/adapters/newsite-adapter.js` extending `BaseAdapter`
2. Implement required methods
3. Add to `adapter-factory.js`
4. Done! 🎉

## License

ISC
