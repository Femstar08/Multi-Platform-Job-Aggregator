const BaseAdapter = require('./base-adapter');

class LinkedInAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.siteName = 'linkedin';
    this.sitePattern = /linkedin\.com/i;
  }

  isValidUrl(url) {
    return this.sitePattern.test(url);
  }

  buildSearchUrl(query, location, pageNumber = 0) {
    const params = new URLSearchParams({
      keywords: query,
      location: location || '',
      start: pageNumber * 25
    });
    return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  }

  buildPageUrl(baseUrl, pageNumber) {
    const url = new URL(baseUrl);
    url.searchParams.set('start', pageNumber * 25);
    return url.toString();
  }

  async extractFromJavaScript(page) {
    return await page.evaluate(() => {
      // LinkedIn embeds data in script tags
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
      const jobCards = document.querySelectorAll('.job-search-card, .jobs-search__results-list li');
      
      jobCards.forEach(card => {
        const titleEl = card.querySelector('.base-search-card__title, h3');
        const companyEl = card.querySelector('.base-search-card__subtitle, h4');
        const locationEl = card.querySelector('.job-search-card__location');
        const linkEl = card.querySelector('a[href*="/jobs/view/"]');
        
        if (titleEl && linkEl) {
          jobs.push({
            title: titleEl.textContent?.trim(),
            company: companyEl?.textContent?.trim(),
            location: locationEl?.textContent?.trim(),
            url: linkEl.href,
            id: linkEl.href.match(/\/jobs\/view\/(\d+)/)?.[1]
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

      const description = getTextContent('.show-more-less-html__markup, .description__text');
      const salary = getTextContent('.salary, .compensation__salary');
      const applicants = getTextContent('.num-applicants__caption');
      
      return {
        description,
        salary,
        applicantCount: applicants ? parseInt(applicants.match(/\d+/)?.[0]) : null
      };
    });
  }

  normalizeData(rawData) {
    const salary = this._parseSalary(rawData.salary);
    
    return {
      id: rawData.id || this._generateId(rawData.url),
      url: rawData.url,
      source: 'linkedin',
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
      jobType: null,
      experienceLevel: null,
      postedDate: rawData.postedDate || new Date().toISOString(),
      applicantCount: rawData.applicantCount,
      companyLogo: null,
      companyRating: null,
      _scrapedAt: new Date().toISOString(),
      _site: this.siteName
    };
  }

  _parseSalary(salaryText) {
    if (!salaryText) return { min: null, max: null, currency: null, period: null };
    
    const match = salaryText.match(/\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/);
    if (!match) return { min: null, max: null, currency: null, period: null };
    
    return {
      min: match[1] ? parseInt(match[1].replace(/,/g, '')) : null,
      max: match[2] ? parseInt(match[2].replace(/,/g, '')) : null,
      currency: 'USD',
      period: salaryText.toLowerCase().includes('hour') ? 'hour' : 'year'
    };
  }

  _generateId(url) {
    return url.split('/').pop() || `linkedin-${Date.now()}`;
  }
}

module.exports = LinkedInAdapter;
