const { Actor } = require('apify');
const { PlaywrightCrawler } = require('crawlee');
const AdapterFactory = require('./adapters/adapter-factory');
const Logger = require('./utils/logger');
const { REQUIRED_FIELDS } = require('./utils/field-mapping');
const DuplicateDetector = require('./utils/duplicate-detector');
const ExpirationDetector = require('./utils/expiration-detector');
const SearchModeHandler = require('./utils/search-mode-handler');
const PlatformFilter = require('./utils/platform-filter');
const JobAgeFilter = require('./utils/job-age-filter');

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
    proxyConfiguration,
    // v1.1 parameters
    platforms = ['linkedin', 'indeed', 'glassdoor'],
    searchMode = 'similar',
    jobAge = 'any',
    excludeExpired = false,
    removeDuplicates = false,
    expirationDays = 30,
    searchInterface = 'quick'
  } = input;

  // Initialize v1.1 services
  const platformFilter = new PlatformFilter(platforms);
  const searchModeHandler = new SearchModeHandler();
  const jobAgeFilter = new JobAgeFilter(jobAge);
  const duplicateDetector = new DuplicateDetector();
  const expirationDetector = new ExpirationDetector();

  logger.info('Configuration', {
    platforms,
    searchMode,
    jobAge,
    excludeExpired,
    removeDuplicates,
    searchInterface
  });

  // Build URLs from search queries if provided
  const urls = [...startUrls];
  if (searchQueries && searchQueries.length > 0) {
    for (const query of searchQueries) {
      // Add search URLs for enabled platforms only
      const sites = AdapterFactory.getSupportedSites();
      for (const site of sites) {
        if (!platformFilter.isEnabled(site)) {
          logger.info(`Skipping disabled platform: ${site}`);
          continue;
        }

        const adapter = AdapterFactory.createAdapter(site);
        
        // Apply search mode
        const searchParams = searchModeHandler.adaptForPlatform(query, searchMode, site);
        const searchUrl = adapter.buildSearchUrl(searchParams.keywords || searchParams.q || searchParams.keyword, location);
        
        // Apply job age filter
        const filteredUrl = jobAgeFilter.applyToUrl(searchUrl, site);
        
        urls.push({ url: filteredUrl });
        logger.info(`Added ${site} URL with ${searchMode} mode and ${jobAge} age filter`);
      }
    }
  }

  // Filter startUrls by enabled platforms
  const filteredStartUrls = platformFilter.filterUrls(urls.map(u => typeof u === 'string' ? u : u.url));
  const finalUrls = filteredStartUrls.map(url => ({ url }));

  if (finalUrls.length === 0) {
    throw new Error('No URLs provided. Add startUrls or searchQueries.');
  }

  logger.info('Starting crawl', { urlCount: finalUrls.length });

  const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);
  let itemCount = 0;
  const scrapedJobs = []; // Store jobs for post-processing

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

        // Normalize and store jobs (don't save yet - post-processing needed)
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

            scrapedJobs.push(normalized);
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

  await crawler.run(finalUrls);

  logger.info('Crawling complete, starting post-processing pipeline', { 
    scrapedJobs: scrapedJobs.length 
  });

  // Post-processing pipeline
  let processedJobs = scrapedJobs;

  // Step 1: Detect duplicates
  logger.info('Step 1: Detecting duplicates...');
  processedJobs = duplicateDetector.detectDuplicates(processedJobs);
  const duplicateCount = processedJobs.filter(j => j._isDuplicate).length;
  logger.info(`Found ${duplicateCount} duplicates`);

  // Step 2: Mark expiration
  logger.info('Step 2: Marking expired jobs...');
  processedJobs = expirationDetector.markExpiration(processedJobs, expirationDays);
  const expiredCount = processedJobs.filter(j => j._isExpired).length;
  logger.info(`Found ${expiredCount} expired jobs`);

  // Step 3: Apply filters based on user preferences
  if (removeDuplicates) {
    logger.info('Step 3a: Removing duplicates...');
    const beforeCount = processedJobs.length;
    processedJobs = duplicateDetector.removeDuplicates(processedJobs);
    logger.info(`Removed ${beforeCount - processedJobs.length} duplicate jobs`);
  }

  if (excludeExpired) {
    logger.info('Step 3b: Removing expired jobs...');
    const beforeCount = processedJobs.length;
    processedJobs = expirationDetector.filterExpired(processedJobs);
    logger.info(`Removed ${beforeCount - processedJobs.length} expired jobs`);
  }

  // Step 4: Apply job age filter if specified
  if (jobAge !== 'any') {
    logger.info(`Step 4: Filtering by job age (${jobAge})...`);
    const beforeCount = processedJobs.length;
    const maxAge = jobAgeFilter.ageDays;
    processedJobs = expirationDetector.filterByAge(processedJobs, maxAge);
    logger.info(`Removed ${beforeCount - processedJobs.length} jobs older than ${maxAge} days`);
  }

  // Step 5: Save processed jobs to dataset
  logger.info('Step 5: Saving processed jobs...');
  for (const job of processedJobs) {
    await Actor.pushData(job);
  }

  logger.info('Job Aggregator finished', { 
    totalScraped: scrapedJobs.length,
    totalSaved: processedJobs.length,
    duplicatesFound: duplicateCount,
    expiredFound: expiredCount,
    duplicatesRemoved: removeDuplicates ? duplicateCount : 0,
    expiredRemoved: excludeExpired ? expiredCount : 0
  });
});
