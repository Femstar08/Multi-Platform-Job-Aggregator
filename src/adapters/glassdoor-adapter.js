const BaseAdapter = require('./base-adapter');

class GlassdoorAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.siteName = 'glassdoor';
    this.sitePattern = /glassdoor\.com/i;
  }

  isValidUrl(url) {
    return this.sitePattern.test(url);
  }

  buildSearchUrl(query, location, pageNumber = 0) {
    const params = new URLSearchParams({
      keyword: query,
      location: location || '',
      page: pageNumber + 1
    });
    return `https://www.glassdoor.com/Job/jobs.htm?${params.toString()}`;
  }

  buildPageUrl(baseUrl, pageNumber) {
    const url = new URL(baseUrl);
    url.searchParams.set('page', pageNumber + 1);
    return url.toString();
  }

  async extractFromJavaScript(page) {
    return await page.evaluate(() => {
      // Glassdoor uses Apollo cache
      if (window.__APOLLO_STATE__) {
        return window.__APOLLO_STATE__;
      }
      
      // Check for JSON-LD
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'JobPosting') return data;
        } catch (e) {
          continue;
        }
      }
      return null;
    });
  }

  async extractFromDOM(page) {
    return await page.evaluate(() => {
      const jobs = [];
      const jobCards = document.querySelectorAll('li[data-test="jobListing"], .react-job-listing');
      
      jobCards.forEach(card => {
        const titleEl = card.querySelector('[data-test="job-title"], .job-title');
        const companyEl = card.querySelector('[data-test="employer-name"], .employer-name');
        const locationEl = card.querySelector('[data-test="emp-location"], .location');
        const salaryEl = card.querySelector('[data-test="detailSalary"], .salary-estimate');
        const ratingEl = card.querySelector('.rating');
        const linkEl = card.querySelector('a[data-test="job-link"]');
        
        if (titleEl) {
          const jobId = linkEl?.href?.match(/jobListingId=(\d+)/)?.[1] ||
                       card.getAttribute('data-id');
          
          jobs.push({
            id: jobId,
            title: titleEl.textContent?.trim(),
            company: companyEl?.textContent?.trim(),
            location: locationEl?.textContent?.trim(),
            salary: salaryEl?.textContent?.trim(),
            companyRating: ratingEl ? parseFloat(ratingEl.textContent) : null,
            url: linkEl?.href
          });
        }
      });
      
      return jobs;
    });
  }

  async extractFullDetails(page) {
    return await page.evaluate(() => {
      const getTextContent = (selector) => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || null;
      };

      const description = getTextContent('[data-test="jobDescriptionContent"], .jobDescriptionContent');
      const salary = getTextContent('[data-test="detailSalary"]');
      const benefits = Array.from(document.querySelectorAll('.benefits li'))
        .map(el => el.textContent?.trim());
      
      return {
        description,
        salary,
        benefits
      };
    });
  }

  normalizeData(rawData) {
    const salary = this._parseSalary(rawData.salary);
    
    return {
      id: rawData.id || this._generateId(rawData.url),
      url: rawData.url || `https://www.glassdoor.com/job-listing/${rawData.id}`,
      source: 'glassdoor',
      title: rawData.title,
      company: rawData.company,
      location: rawData.location || 'Not specified',
      salary: {
        min: salary.min,
        max: salary.max,
        currency: salary.currency,
        period: salary.period
      },
      description: rawData.description || '',
      requirements: [],
      benefits: rawData.benefits || [],
      jobType: null,
      experienceLevel: null,
      postedDate: rawData.postedDate || new Date().toISOString(),
      applicantCount: null,
      companyLogo: null,
      companyRating: rawData.companyRating,
      _scrapedAt: new Date().toISOString(),
      _site: this.siteName
    };
  }

  _parseSalary(salaryText) {
    if (!salaryText) return { min: null, max: null, currency: null, period: null };
    
    // Glassdoor format: "$80K - $120K (Employer est.)"
    const match = salaryText.match(/\$?([\d,]+)K?\s*-\s*\$?([\d,]+)K?/);
    if (!match) return { min: null, max: null, currency: null, period: null };
    
    const multiplier = salaryText.includes('K') ? 1000 : 1;
    
    return {
      min: match[1] ? parseInt(match[1].replace(/,/g, '')) * multiplier : null,
      max: match[2] ? parseInt(match[2].replace(/,/g, '')) * multiplier : null,
      currency: 'USD',
      period: 'year'
    };
  }

  _generateId(url) {
    return url?.match(/jobListingId=(\d+)/)?.[1] || `glassdoor-${Date.now()}`;
  }
}

module.exports = GlassdoorAdapter;
