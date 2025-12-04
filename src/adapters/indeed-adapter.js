const BaseAdapter = require('./base-adapter');

class IndeedAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.siteName = 'indeed';
    this.sitePattern = /indeed\.com/i;
  }

  isValidUrl(url) {
    return this.sitePattern.test(url);
  }

  buildSearchUrl(query, location, pageNumber = 0) {
    const params = new URLSearchParams({
      q: query,
      l: location || '',
      start: pageNumber * 10
    });
    return `https://www.indeed.com/jobs?${params.toString()}`;
  }

  buildPageUrl(baseUrl, pageNumber) {
    const url = new URL(baseUrl);
    url.searchParams.set('start', pageNumber * 10);
    return url.toString();
  }

  async extractFromJavaScript(page) {
    return await page.evaluate(() => {
      // Indeed uses window.mosaic.providerData
      if (window.mosaic?.providerData) {
        return window.mosaic.providerData;
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
      const jobCards = document.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList > li');
      
      jobCards.forEach(card => {
        const titleEl = card.querySelector('h2.jobTitle a, .jobTitle span');
        const companyEl = card.querySelector('.companyName');
        const locationEl = card.querySelector('.companyLocation');
        const salaryEl = card.querySelector('.salary-snippet');
        const linkEl = card.querySelector('h2.jobTitle a');
        
        if (titleEl) {
          const jobKey = linkEl?.href?.match(/jk=([^&]+)/)?.[1] || 
                        card.getAttribute('data-jk');
          
          jobs.push({
            id: jobKey,
            title: titleEl.textContent?.trim(),
            company: companyEl?.textContent?.trim(),
            location: locationEl?.textContent?.trim(),
            salary: salaryEl?.textContent?.trim(),
            url: linkEl?.href ? `https://www.indeed.com${linkEl.href}` : null
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

      const description = getTextContent('#jobDescriptionText, .jobsearch-jobDescriptionText');
      const salary = getTextContent('.jobsearch-JobMetadataHeader-item .attribute_snippet');
      const jobType = getTextContent('.jobsearch-JobMetadataHeader-item:has-text("job type")');
      
      return {
        description,
        salary,
        jobType
      };
    });
  }

  normalizeData(rawData) {
    const salary = this._parseSalary(rawData.salary);
    
    return {
      id: rawData.id || this._generateId(rawData.url),
      url: rawData.url || `https://www.indeed.com/viewjob?jk=${rawData.id}`,
      source: 'indeed',
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
      benefits: [],
      jobType: this._normalizeJobType(rawData.jobType),
      experienceLevel: null,
      postedDate: rawData.postedDate || new Date().toISOString(),
      applicantCount: null,
      companyLogo: null,
      companyRating: null,
      _scrapedAt: new Date().toISOString(),
      _site: this.siteName
    };
  }

  _parseSalary(salaryText) {
    if (!salaryText) return { min: null, max: null, currency: null, period: null };
    
    const match = salaryText.match(/\$?([\d,]+(?:\.\d+)?)(?:\s*-\s*\$?([\d,]+(?:\.\d+)?))?/);
    if (!match) return { min: null, max: null, currency: null, period: null };
    
    let period = 'year';
    if (salaryText.toLowerCase().includes('hour')) period = 'hour';
    if (salaryText.toLowerCase().includes('month')) period = 'month';
    
    return {
      min: match[1] ? parseFloat(match[1].replace(/,/g, '')) : null,
      max: match[2] ? parseFloat(match[2].replace(/,/g, '')) : null,
      currency: 'USD',
      period
    };
  }

  _normalizeJobType(jobType) {
    if (!jobType) return null;
    const lower = jobType.toLowerCase();
    if (lower.includes('full')) return 'full-time';
    if (lower.includes('part')) return 'part-time';
    if (lower.includes('contract')) return 'contract';
    if (lower.includes('intern')) return 'internship';
    return null;
  }

  _generateId(url) {
    return url?.match(/jk=([^&]+)/)?.[1] || `indeed-${Date.now()}`;
  }
}

module.exports = IndeedAdapter;
