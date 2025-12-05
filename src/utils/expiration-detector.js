/**
 * Expiration Detection Service
 * 
 * Detects expired jobs and calculates job age based on posted date.
 */
class ExpirationDetector {
  /**
   * Calculate the age of a job in days
   * @param {string|Date} postedDate - Job posted date
   * @returns {number|null} Age in days, or null if no date
   */
  calculateAge(postedDate) {
    if (!postedDate) return null;
    
    const posted = new Date(postedDate);
    const now = new Date();
    
    if (isNaN(posted.getTime())) return null;
    
    const diffMs = now - posted;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 ? diffDays : null;
  }

  /**
   * Check if a job is expired
   * @param {Object} job - Job object with postedDate
   * @param {number} expirationDays - Days until expiration
   * @returns {boolean} True if expired
   */
  isExpired(job, expirationDays = 30) {
    const age = this.calculateAge(job.postedDate);
    
    if (age === null) return false;
    
    return age > expirationDays;
  }

  /**
   * Mark jobs with expiration metadata
   * @param {Array<Object>} jobs - Array of job objects
   * @param {number} expirationDays - Days until expiration
   * @returns {Array<Object>} Jobs with expiration metadata
   */
  markExpiration(jobs, expirationDays = 30) {
    return jobs.map(job => {
      const age = this.calculateAge(job.postedDate);
      const expired = age !== null && age > expirationDays;
      
      return {
        ...job,
        _ageInDays: age,
        _isExpired: expired
      };
    });
  }

  /**
   * Filter out expired jobs
   * @param {Array<Object>} jobs - Array of jobs with expiration metadata
   * @returns {Array<Object>} Jobs with expired ones removed
   */
  filterExpired(jobs) {
    return jobs.filter(job => !job._isExpired);
  }

  /**
   * Filter jobs by maximum age
   * @param {Array<Object>} jobs - Array of jobs with age metadata
   * @param {number} maxAgeDays - Maximum age in days
   * @returns {Array<Object>} Jobs within age limit
   */
  filterByAge(jobs, maxAgeDays) {
    return jobs.filter(job => {
      if (job._ageInDays === null) return true; // Keep jobs without dates
      return job._ageInDays <= maxAgeDays;
    });
  }
}

module.exports = ExpirationDetector;
