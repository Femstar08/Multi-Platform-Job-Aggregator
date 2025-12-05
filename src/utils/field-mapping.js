/**
 * Unified Job Schema Definition v1.1
 * All adapters must normalize their data to this schema
 */

const UNIFIED_JOB_SCHEMA = {
  // Core identifiers
  id: 'string',
  url: 'string',
  source: 'string', // 'linkedin' | 'indeed' | 'glassdoor'
  
  // Job details
  title: 'string',
  company: 'string',
  location: 'string',
  
  // Compensation
  salary: {
    min: 'number|null',
    max: 'number|null',
    currency: 'string|null',
    period: 'string|null' // 'year' | 'month' | 'hour'
  },
  
  // Job info
  description: 'string',
  requirements: 'array',
  benefits: 'array',
  jobType: 'string|null', // 'full-time' | 'part-time' | 'contract' | 'internship'
  experienceLevel: 'string|null', // 'entry' | 'mid' | 'senior' | 'executive'
  
  // Metadata
  postedDate: 'string',
  applicantCount: 'number|null',
  companyLogo: 'string|null',
  companyRating: 'number|null',
  
  // Duplicate detection (v1.1)
  _isDuplicate: 'boolean',
  _duplicateOf: 'string|null',
  _fingerprint: 'string',
  sources: 'array', // Array of platform names where this job appears
  
  // Expiration detection (v1.1)
  _isExpired: 'boolean',
  _ageInDays: 'number|null',
  
  // Scraping metadata
  _scrapedAt: 'string',
  _site: 'string'
};

const REQUIRED_FIELDS = ['id', 'url', 'source', 'title', 'company'];

module.exports = {
  UNIFIED_JOB_SCHEMA,
  REQUIRED_FIELDS
};
