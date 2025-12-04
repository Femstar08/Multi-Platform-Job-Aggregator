# Quick Start Guide - Job Aggregator

Get started scraping jobs from LinkedIn, Indeed, and Glassdoor in minutes.

## Installation

```bash
cd job-aggregator
npm install
```

## Run Locally

```bash
npm start
```

## Basic Usage

### Example 1: Scrape Specific URLs

Create `input.json`:

```json
{
  "startUrls": [
    {
      "url": "https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=San%20Francisco"
    },
    { "url": "https://www.indeed.com/jobs?q=software+engineer&l=San+Francisco" }
  ],
  "maxItems": 50,
  "maxPages": 3
}
```

### Example 2: Auto-Search All Platforms

```json
{
  "searchQueries": ["software engineer", "data scientist"],
  "location": "San Francisco, CA",
  "maxItems": 100
}
```

This automatically generates search URLs for LinkedIn, Indeed, AND Glassdoor!

## Output

Jobs are saved to `apify_storage/datasets/default/` in JSON format:

```json
{
  "id": "3789456123",
  "url": "https://www.linkedin.com/jobs/view/3789456123",
  "source": "linkedin",
  "title": "Senior Software Engineer",
  "company": "Tech Corp",
  "location": "San Francisco, CA",
  "salary": {
    "min": 150000,
    "max": 200000,
    "currency": "USD",
    "period": "year"
  },
  "description": "We're looking for...",
  "jobType": "full-time",
  "postedDate": "2024-12-04T10:30:00Z",
  "applicantCount": 127,
  "_scrapedAt": "2024-12-04T15:45:00Z",
  "_site": "linkedin"
}
```

## Deploy to Apify

1. Create account at [apify.com](https://apify.com)
2. Install Apify CLI:

```bash
npm install -g apify-cli
apify login
```

3. Deploy:

```bash
apify push
```

## Add More Job Sites

Want to add Monster, ZipRecruiter, or other sites?

1. Create `src/adapters/monster-adapter.js`:

```javascript
const BaseAdapter = require("./base-adapter");

class MonsterAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.siteName = "monster";
  }

  isValidUrl(url) {
    return url.includes("monster.com");
  }

  // Implement other methods...
}

module.exports = MonsterAdapter;
```

2. Add to `adapter-factory.js`:

```javascript
const MonsterAdapter = require('./monster-adapter');

// In createAdapter():
case 'monster':
  return new MonsterAdapter(config);
```

3. Done! 🎉

## Testing

```bash
npm test
npm test -- --coverage
```

## Common Issues

**Issue**: "No jobs found"

- Check if the URL is correct
- Try adding proxy configuration
- Increase wait time in main.js

**Issue**: "Rate limited"

- Add proxy configuration in input
- Reduce maxItems or add delays

**Issue**: "Missing fields"

- Check adapter's normalizeData() method
- Verify site hasn't changed structure

## Next Steps

- Add more job sites (Monster, ZipRecruiter, etc.)
- Implement job detail scraping
- Add email alerts for new jobs
- Build a job board with the data
- Set up scheduled runs

## Support

- Check the [README.md](README.md) for architecture details
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for design patterns
- See adapter examples in `src/adapters/`
