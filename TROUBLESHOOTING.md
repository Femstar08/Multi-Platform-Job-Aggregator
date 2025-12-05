# Troubleshooting Guide - Job Aggregator

## Common Issues and Solutions

### 1. Indeed Returns 403 Errors ❌

**Problem**: Indeed blocks requests with 403 status code.

**Why**: Indeed has strong anti-bot protection and blocks automated scrapers.

**Solutions**:

- ✅ Use residential proxies (not datacenter proxies)
- ✅ Add random delays between requests
- ✅ Rotate user agents
- ✅ Consider using Indeed's official API if available
- ✅ For now, disable Indeed in platform selection:
  ```json
  {
    "platforms": ["linkedin", "glassdoor"]
  }
  ```

### 2. Glassdoor Timeouts ⏱️

**Problem**: Glassdoor pages take too long to load (60+ seconds).

**Why**: Glassdoor has heavy JavaScript and anti-bot measures.

**Solutions**:

- ✅ Increase timeout in actor.json:
  ```json
  {
    "defaultRunOptions": {
      "timeoutSecs": 7200
    }
  }
  ```
- ✅ Use residential proxies
- ✅ Add longer wait times for page load
- ✅ Consider disabling Glassdoor for faster runs:
  ```json
  {
    "platforms": ["linkedin", "indeed"]
  }
  ```

### 3. Actor Timeout Before Post-Processing 🕐

**Problem**: Actor times out (300 seconds) before post-processing pipeline runs.

**Why**: Scraping takes longer than expected, especially with retries.

**Solutions**:

- ✅ Increase timeout in run options (Input > Run options > Timeout)
- ✅ Reduce maxPages to scrape fewer pages:
  ```json
  {
    "maxPages": 2
  }
  ```
- ✅ Reduce maxItems:
  ```json
  {
    "maxItems": 50
  }
  ```
- ✅ Use fewer platforms:
  ```json
  {
    "platforms": ["linkedin"]
  }
  ```

### 4. Post-Processing Pipeline Not Running 🔄

**Problem**: Jobs are scraped but not processed (no duplicate detection, etc.).

**Why**: Actor times out or crashes before pipeline runs.

**Solutions**:

- ✅ Ensure actor completes successfully (check logs for "Job Aggregator finished")
- ✅ Increase timeout
- ✅ Reduce scraping scope
- ✅ Check for errors in logs

### 5. LinkedIn Works, Others Don't ✅

**Current Status**: LinkedIn is the most reliable platform.

**Recommendation**: For production use, focus on LinkedIn:

```json
{
  "searchQueries": ["software engineer"],
  "location": "San Francisco",
  "platforms": ["linkedin"],
  "searchMode": "exact",
  "jobAge": "7d",
  "removeDuplicates": true
}
```

## Recommended Configuration for Production

### Option 1: LinkedIn Only (Most Reliable)

```json
{
  "searchQueries": ["AI Product Lead"],
  "location": "United Kingdom",
  "platforms": ["linkedin"],
  "searchMode": "exact",
  "jobAge": "7d",
  "removeDuplicates": false,
  "excludeExpired": false,
  "maxPages": 3,
  "maxItems": 75
}
```

### Option 2: Multi-Platform with Residential Proxies

```json
{
  "searchQueries": ["software engineer"],
  "location": "San Francisco",
  "platforms": ["linkedin", "glassdoor"],
  "searchMode": "similar",
  "jobAge": "any",
  "removeDuplicates": true,
  "excludeExpired": true,
  "maxPages": 2,
  "maxItems": 50,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Proxy Configuration

### Using Apify Proxy (Recommended)

**Residential Proxies** (Best for anti-bot sites):

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

**Datacenter Proxies** (Cheaper, may be blocked):

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

### Custom Proxy

```json
{
  "proxyConfiguration": {
    "proxyUrls": ["http://username:password@proxy.example.com:8000"]
  }
}
```

## Performance Optimization

### 1. Reduce Scraping Scope

- Use specific search queries
- Limit to 1-2 platforms
- Set lower maxPages (2-3)
- Set lower maxItems (50-100)

### 2. Increase Timeout

- Set timeout to 1800-3600 seconds for multi-platform
- Set timeout to 600-900 seconds for LinkedIn only

### 3. Use Better Proxies

- Residential proxies for Indeed and Glassdoor
- Datacenter proxies work fine for LinkedIn

## Monitoring and Debugging

### Check Logs For:

**Success Indicators**:

- ✅ "Job Aggregator finished" message
- ✅ "Crawling complete, starting post-processing pipeline"
- ✅ "Step 1: Detecting duplicates..."
- ✅ "Step 5: Saving processed jobs..."

**Warning Signs**:

- ⚠️ "Request blocked - received 403 status code"
- ⚠️ "Navigation timed out"
- ⚠️ "Request failed and reached maximum retries"
- ⚠️ "The Actor run has reached the timeout"

### Dataset Check:

After run completes, check dataset for:

- Jobs have `_isDuplicate` field
- Jobs have `_isExpired` field
- Jobs have `_ageInDays` field
- Jobs have `sources` array
- Jobs have `_fingerprint` field

If these fields are missing, post-processing didn't run.

## Platform-Specific Issues

### LinkedIn

- ✅ **Status**: Working well
- ✅ **Success Rate**: ~95%
- ✅ **Recommendation**: Primary platform

### Indeed

- ❌ **Status**: Blocked (403 errors)
- ❌ **Success Rate**: ~0%
- ⚠️ **Recommendation**: Disable or use residential proxies

### Glassdoor

- ⚠️ **Status**: Slow/Timeouts
- ⚠️ **Success Rate**: ~30%
- ⚠️ **Recommendation**: Use with caution, residential proxies

## Quick Fixes

### Fix 1: LinkedIn Only Run

```json
{
  "searchQueries": ["your search term"],
  "location": "your location",
  "platforms": ["linkedin"],
  "maxPages": 3,
  "maxItems": 75
}
```

### Fix 2: Increase Timeout

In Apify Console:

1. Go to Input tab
2. Scroll to "Run options"
3. Set "Timeout" to 1800 seconds (30 minutes)

### Fix 3: Use Residential Proxies

In Apify Console:

1. Go to Input tab
2. Add proxy configuration:

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Testing v1.1 Features

### Test Duplicate Detection

```json
{
  "searchQueries": ["software engineer"],
  "location": "San Francisco",
  "platforms": ["linkedin"],
  "removeDuplicates": true,
  "maxPages": 5
}
```

Check dataset for:

- Some jobs have `_isDuplicate: true`
- Duplicate jobs have `_duplicateOf` pointing to original
- Original jobs have multiple entries in `sources` array

### Test Expiration Filtering

```json
{
  "searchQueries": ["software engineer"],
  "location": "San Francisco",
  "platforms": ["linkedin"],
  "excludeExpired": true,
  "expirationDays": 30,
  "maxPages": 3
}
```

Check dataset for:

- All jobs have `_isExpired: false`
- All jobs have `_ageInDays` <= 30 or null

### Test Search Modes

```json
{
  "searchQueries": ["senior software engineer"],
  "location": "San Francisco",
  "platforms": ["linkedin"],
  "searchMode": "exact",
  "maxPages": 2
}
```

Check results:

- Job titles should closely match "senior software engineer"
- Fewer results than "similar" mode

## Getting Help

If issues persist:

1. Check Apify Console logs
2. Verify input configuration
3. Test with LinkedIn only first
4. Increase timeout
5. Try residential proxies
6. Check dataset for post-processing fields

## Known Limitations

- Indeed has strong anti-bot protection (403 errors common)
- Glassdoor can be slow (60+ second page loads)
- Post-processing requires actor to complete successfully
- Residential proxies recommended for production use
- LinkedIn is the most reliable platform

---

**Last Updated**: December 2024  
**Version**: 1.1.0
