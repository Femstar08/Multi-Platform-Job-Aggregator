/**
 * Search Mode Handler
 * 
 * Handles exact vs similar search modes for different platforms.
 */
class SearchModeHandler {
  /**
   * Build search query based on mode
   * @param {string} keywords - Search keywords
   * @param {string} mode - 'exact' or 'similar'
   * @returns {string} Formatted keywords
   */
  buildSearchQuery(keywords, mode = 'similar') {
    if (mode === 'exact') {
      return `"${keywords}"`;
    }
    return keywords;
  }

  /**
   * Adapt keywords for specific platform
   * @param {string} keywords - Search keywords
   * @param {string} mode - 'exact' or 'similar'
   * @param {string} platform - Platform name
   * @returns {Object} Platform-specific query parameters
   */
  adaptForPlatform(keywords, mode, platform) {
    const handlers = {
      linkedin: this.linkedInHandler.bind(this),
      indeed: this.indeedHandler.bind(this),
      glassdoor: this.glassdoorHandler.bind(this)
    };

    const handler = handlers[platform.toLowerCase()];
    if (!handler) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return handler(keywords, mode);
  }

  /**
   * LinkedIn-specific search handling
   * @param {string} keywords - Search keywords
   * @param {string} mode - 'exact' or 'similar'
   * @returns {Object} LinkedIn query parameters
   */
  linkedInHandler(keywords, mode) {
    if (mode === 'exact') {
      return {
        keywords: `"${keywords}"`,
        exactMatch: true
      };
    }
    return {
      keywords: keywords,
      exactMatch: false
    };
  }

  /**
   * Indeed-specific search handling
   * @param {string} keywords - Search keywords
   * @param {string} mode - 'exact' or 'similar'
   * @returns {Object} Indeed query parameters
   */
  indeedHandler(keywords, mode) {
    if (mode === 'exact') {
      return {
        q: keywords,
        exactphrase: keywords
      };
    }
    return {
      q: keywords
    };
  }

  /**
   * Glassdoor-specific search handling
   * @param {string} keywords - Search keywords
   * @param {string} mode - 'exact' or 'similar'
   * @returns {Object} Glassdoor query parameters
   */
  glassdoorHandler(keywords, mode) {
    if (mode === 'exact') {
      return {
        keyword: `"${keywords}"`,
        exactMatch: true
      };
    }
    return {
      keyword: keywords,
      exactMatch: false
    };
  }
}

module.exports = SearchModeHandler;
