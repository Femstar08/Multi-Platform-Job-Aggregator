/**
 * Adapter Factory
 * Routes to the correct job site adapter based on URL or site name
 */

const LinkedInAdapter = require('./linkedin-adapter');
const IndeedAdapter = require('./indeed-adapter');
const GlassdoorAdapter = require('./glassdoor-adapter');

class AdapterFactory {
  static createAdapter(siteNameOrUrl, config = {}) {
    const siteName = this._detectSite(siteNameOrUrl);
    
    switch (siteName) {
      case 'linkedin':
        return new LinkedInAdapter(config);
      case 'indeed':
        return new IndeedAdapter(config);
      case 'glassdoor':
        return new GlassdoorAdapter(config);
      
      default:
        throw new Error(
          `Unsupported site: ${siteName}. ` +
          `Supported sites: ${this.getSupportedSites().join(', ')}`
        );
    }
  }

  static _detectSite(siteNameOrUrl) {
    if (!siteNameOrUrl || typeof siteNameOrUrl !== 'string') {
      throw new Error('Site name or URL is required');
    }

    const lower = siteNameOrUrl.toLowerCase();

    // Check if it's a URL
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      try {
        const url = new URL(siteNameOrUrl);
        const hostname = url.hostname.toLowerCase();

        if (hostname.includes('linkedin.com')) return 'linkedin';
        if (hostname.includes('indeed.com')) return 'indeed';
        if (hostname.includes('glassdoor.com')) return 'glassdoor';

        throw new Error(`Unknown job site: ${hostname}`);
      } catch (error) {
        if (error.message.includes('Unknown job site')) {
          throw error;
        }
        throw new Error(`Invalid URL: ${siteNameOrUrl}`);
      }
    }

    // It's a site name - normalize it
    if (lower === 'linkedin') return 'linkedin';
    if (lower === 'indeed') return 'indeed';
    if (lower === 'glassdoor') return 'glassdoor';

    throw new Error(`Unknown site name: ${siteNameOrUrl}`);
  }

  static getSupportedSites() {
    return ['linkedin', 'indeed', 'glassdoor'];
  }

  static isSiteSupported(siteName) {
    try {
      const normalized = this._detectSite(siteName);
      return this.getSupportedSites().includes(normalized);
    } catch {
      return false;
    }
  }
}

module.exports = AdapterFactory;
