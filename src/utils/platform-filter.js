/**
 * Platform Filter
 * 
 * Filters which platforms to search based on user selection.
 */
class PlatformFilter {
  /**
   * @param {Array<string>} selectedPlatforms - Array of platform names to enable
   */
  constructor(selectedPlatforms = ['linkedin', 'indeed', 'glassdoor']) {
    this.selectedPlatforms = selectedPlatforms.map(p => p.toLowerCase());
  }

  /**
   * Check if a platform is enabled
   * @param {string} platform - Platform name
   * @returns {boolean} True if enabled
   */
  isEnabled(platform) {
    return this.selectedPlatforms.includes(platform.toLowerCase());
  }

  /**
   * Detect platform from URL
   * @param {string} url - URL to check
   * @returns {string|null} Platform name or null
   */
  detectPlatform(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    if (urlLower.includes('indeed.com')) return 'indeed';
    if (urlLower.includes('glassdoor.com')) return 'glassdoor';
    
    return null;
  }

  /**
   * Filter URLs to only include enabled platforms
   * @param {Array<string>} urls - Array of URLs
   * @returns {Array<string>} Filtered URLs
   */
  filterUrls(urls) {
    return urls.filter(url => {
      const platform = this.detectPlatform(url);
      return platform && this.isEnabled(platform);
    });
  }

  /**
   * Get list of enabled platforms
   * @returns {Array<string>} Enabled platform names
   */
  getEnabledPlatforms() {
    return [...this.selectedPlatforms];
  }
}

module.exports = PlatformFilter;
