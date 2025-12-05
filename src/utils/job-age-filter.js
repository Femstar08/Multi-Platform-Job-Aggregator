/**
 * Job Age Filter
 * 
 * Applies job age filters to search URLs for different platforms.
 */
class JobAgeFilter {
  /**
   * @param {string} ageFilter - Age filter ('any', '24h', '7d', '14d', '30d')
   */
  constructor(ageFilter = 'any') {
    this.ageFilter = ageFilter;
    this.ageDays = this.parseAgeFilter(ageFilter);
  }

  /**
   * Parse age filter string to days
   * @param {string} filter - Age filter string
   * @returns {number|null} Days or null for 'any'
   */
  parseAgeFilter(filter) {
    const mapping = {
      'any': null,
      '24h': 1,
      '7d': 7,
      '14d': 14,
      '30d': 30
    };
    
    return mapping[filter] !== undefined ? mapping[filter] : null;
  }

  /**
   * Apply age filter to URL based on platform
   * @param {string} url - Original URL
   * @param {string} platform - Platform name
   * @returns {string} URL with age filter applied
   */
  applyToUrl(url, platform) {
    if (this.ageDays === null) return url;
    
    const handlers = {
      linkedin: this.applyLinkedIn.bind(this),
      indeed: this.applyIndeed.bind(this),
      glassdoor: this.applyGlassdoor.bind(this)
    };
    
    const handler = handlers[platform.toLowerCase()];
    if (!handler) return url;
    
    return handler(url);
  }

  /**
   * Apply age filter to LinkedIn URL
   * @param {string} url - LinkedIn URL
   * @returns {string} URL with f_TPR parameter
   */
  applyLinkedIn(url) {
    const urlObj = new URL(url);
    
    // LinkedIn uses f_TPR (Time Period Range)
    // r86400 = past 24 hours, r604800 = past week, r2592000 = past month
    const tprMapping = {
      1: 'r86400',
      7: 'r604800',
      14: 'r1209600',
      30: 'r2592000'
    };
    
    const tprValue = tprMapping[this.ageDays];
    if (tprValue) {
      urlObj.searchParams.set('f_TPR', tprValue);
    }
    
    return urlObj.toString();
  }

  /**
   * Apply age filter to Indeed URL
   * @param {string} url - Indeed URL
   * @returns {string} URL with fromage parameter
   */
  applyIndeed(url) {
    const urlObj = new URL(url);
    
    // Indeed uses fromage (days)
    if (this.ageDays !== null) {
      urlObj.searchParams.set('fromage', this.ageDays.toString());
    }
    
    return urlObj.toString();
  }

  /**
   * Apply age filter to Glassdoor URL
   * @param {string} url - Glassdoor URL
   * @returns {string} URL with fromAge parameter
   */
  applyGlassdoor(url) {
    const urlObj = new URL(url);
    
    // Glassdoor uses fromAge (days)
    if (this.ageDays !== null) {
      urlObj.searchParams.set('fromAge', this.ageDays.toString());
    }
    
    return urlObj.toString();
  }
}

module.exports = JobAgeFilter;
