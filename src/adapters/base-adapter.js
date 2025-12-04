/**
 * Base Adapter Interface
 * All job site adapters MUST implement these methods
 */
class BaseAdapter {
  constructor(config = {}) {
    this.config = config;
    this.siteName = 'base';
    this.sitePattern = null;
  }

  isValidUrl(url) {
    throw new Error('isValidUrl() must be implemented by subclass');
  }

  buildSearchUrl(query, location, pageNumber = 0) {
    throw new Error('buildSearchUrl() must be implemented by subclass');
  }

  buildPageUrl(baseUrl, pageNumber) {
    throw new Error('buildPageUrl() must be implemented by subclass');
  }

  async extractFromJavaScript(page, options = {}) {
    throw new Error('extractFromJavaScript() must be implemented by subclass');
  }

  async extractFromDOM(page, options = {}) {
    throw new Error('extractFromDOM() must be implemented by subclass');
  }

  async extractFullDetails(page, options = {}) {
    throw new Error('extractFullDetails() must be implemented by subclass');
  }

  normalizeData(rawData) {
    throw new Error('normalizeData() must be implemented by subclass');
  }

  async initialize() {
    // Override if needed
  }

  async cleanup() {
    // Override if needed
  }

  getSiteConfig() {
    return {
      name: this.siteName,
      ...this.config
    };
  }
}

module.exports = BaseAdapter;
