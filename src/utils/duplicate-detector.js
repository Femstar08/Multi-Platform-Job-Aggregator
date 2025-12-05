const crypto = require('crypto');

/**
 * Duplicate Detection Service
 * 
 * Detects and marks duplicate job listings across platforms using fingerprinting.
 * Jobs are considered duplicates if they have the same normalized title, company, and location.
 */
class DuplicateDetector {
  /**
   * Normalize a job title for comparison
   * @param {string} title - Job title
   * @returns {string} Normalized title
   */
  normalizeTitle(title) {
    if (!title) return '';
    
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Normalize a company name for comparison
   * @param {string} company - Company name
   * @returns {string} Normalized company name
   */
  normalizeCompany(company) {
    if (!company) return '';
    
    const suffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'company', 'co'];
    let normalized = company
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
    
    // Remove common company suffixes
    for (const suffix of suffixes) {
      const regex = new RegExp(`\\b${suffix}\\b$`, 'i');
      normalized = normalized.replace(regex, '').trim();
    }
    
    return normalized;
  }

  /**
   * Normalize a location for comparison
   * @param {string} location - Location string
   * @returns {string} Normalized location
   */
  normalizeLocation(location) {
    if (!location) return '';
    
    return location
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\b(remote|hybrid|onsite)\b/gi, ''); // Remove work mode keywords
  }

  /**
   * Generate a unique fingerprint for a job
   * @param {Object} job - Job object
   * @returns {string} SHA-256 fingerprint
   */
  generateFingerprint(job) {
    const normalizedTitle = this.normalizeTitle(job.title);
    const normalizedCompany = this.normalizeCompany(job.company);
    const normalizedLocation = this.normalizeLocation(job.location);
    
    const fingerprintString = `${normalizedTitle}|${normalizedCompany}|${normalizedLocation}`;
    
    return crypto
      .createHash('sha256')
      .update(fingerprintString)
      .digest('hex');
  }

  /**
   * Detect duplicates in a job array and mark them
   * @param {Array<Object>} jobs - Array of job objects
   * @returns {Array<Object>} Jobs with duplicate metadata added
   */
  detectDuplicates(jobs) {
    const fingerprintMap = new Map();
    const processedJobs = [];
    
    for (const job of jobs) {
      const fingerprint = this.generateFingerprint(job);
      
      if (fingerprintMap.has(fingerprint)) {
        // This is a duplicate
        const original = fingerprintMap.get(fingerprint);
        
        processedJobs.push({
          ...job,
          _fingerprint: fingerprint,
          _isDuplicate: true,
          _duplicateOf: original.id,
          sources: [job.source]
        });
        
        // Update original's sources array
        if (!original.sources.includes(job.source)) {
          original.sources.push(job.source);
        }
      } else {
        // This is the first occurrence
        const processedJob = {
          ...job,
          _fingerprint: fingerprint,
          _isDuplicate: false,
          _duplicateOf: null,
          sources: [job.source]
        };
        
        fingerprintMap.set(fingerprint, processedJob);
        processedJobs.push(processedJob);
      }
    }
    
    return processedJobs;
  }

  /**
   * Remove duplicate jobs from array
   * @param {Array<Object>} jobs - Array of jobs with duplicate metadata
   * @returns {Array<Object>} Jobs with duplicates removed
   */
  removeDuplicates(jobs) {
    return jobs.filter(job => !job._isDuplicate);
  }
}

module.exports = DuplicateDetector;
