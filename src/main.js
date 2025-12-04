const { Actor } = require('apify');
const { PlaywrightCrawler } = require('crawlee');
const AdapterFactory = require('./adapters/adapter-factory');
const Logger = require('./utils/logger');
const { REQUIRED_FIELDS } = require('./utils/field-mapping');

const logger = new Logger({ component: 'main' });

Actor.main(async () => {
  logger.info('Job Aggregator starting...');
  
  const input = await Actor.getInput();
  const { 
    startUrls = [], 
    searchQueries = [],
    location = '',
    maxItems = 100,
    maxPages = 5,
    proxyConfiguration
  } = input;

  // Build URLs from search queries if provided
  const urls = [...startUrls];
  if (searchQueries && searchQueries.length > 0) {
    for (const query of searchQueries) {
      // Add search URLs for all supported sites
      const sites = AdapterFactory.getSupportedSites();
      for (const site of sites) {
        const adapter = AdapterFactory.createAdapter(site);
        const searchUrl = adapter.buildSearchUrl(query, location);
        urls.push({ url: searchUrl });
      }
    }
  }

  if (urls.length === 0) {
    throw new Error('No URLs provided. Add startUrls or searchQueries.');
  }

  logger.info('Starting crawl', { urlCount: urls.length });

  const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);
  let itemCount = 0;

  const crawler = new PlaywrightCrawler({
    proxyConfiguration: proxyConfig,
    maxRequestsPerCrawl: maxItems,
    
    async requestHandler({ request, page, log }) {
      const url = request.url;
      log.info(`Processing: ${url}`);

      try {
        // Detect site and create adapter
        const adapter = AdapterFactory.createAdapter(url);
        log.info(`Using ${adapter.siteName} adapter`);

        // Wait for content to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Extract jobs from listing page
        let jobs = [];
        
        // Try JavaScript extraction first
        const jsData = await adapter.extractFromJavaScript(page);
        if (jsData) {
          log.info('Extracted data from JavaScript');
          jobs = Array.isArray(jsData) ? jsData : [jsData];
        } else {
          // Fallback to DOM extraction
          log.info('Extracting from DOM');
          jobs = await adapter.extractFromDOM(page);
        }

        log.info(`Found ${jobs.length} jobs on page`);

        // Normalize and save jobs
        for (const job of jobs) {
          if (itemCount >= maxItems) break;
          
          try {
            const normalized = adapter.normalizeData(job);
            
            // Validate required fields
            const missingFields = REQUIRED_FIELDS.filter(field => !normalized[field]);
            if (missingFields.length > 0) {
              log.warn(`Skipping job - missing fields: ${missingFields.join(', ')}`);
              continue;
            }

            await Actor.pushData(normalized);
            itemCount++;
            
          } catch (error) {
            log.error(`Failed to normalize job: ${error.message}`);
          }
        }

        // Handle pagination
        const currentPage = parseInt(request.userData.page || 0);
        if (currentPage < maxPages - 1 && itemCount < maxItems) {
          const nextPageUrl = adapter.buildPageUrl(url, currentPage + 1);
          await crawler.addRequests([{
            url: nextPageUrl,
            userData: { page: currentPage + 1 }
          }]);
          log.info(`Added page ${currentPage + 2} to queue`);
        }

      } catch (error) {
        log.error(`Error processing ${url}: ${error.message}`);
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request failed: ${request.url}`);
    }
  });

  await crawler.run(urls);

  logger.info('Job Aggregator finished', { totalJobs: itemCount });
});
