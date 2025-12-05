const JobAgeFilter = require('../src/utils/job-age-filter');

describe('JobAgeFilter', () => {
  describe('parseAgeFilter', () => {
    test('should parse age filters correctly', () => {
      const filter = new JobAgeFilter('24h');
      expect(filter.parseAgeFilter('any')).toBe(null);
      expect(filter.parseAgeFilter('24h')).toBe(1);
      expect(filter.parseAgeFilter('7d')).toBe(7);
      expect(filter.parseAgeFilter('14d')).toBe(14);
      expect(filter.parseAgeFilter('30d')).toBe(30);
    });

    test('should return null for unknown filters', () => {
      const filter = new JobAgeFilter('invalid');
      expect(filter.ageDays).toBe(null);
    });
  });

  describe('applyToUrl', () => {
    test('should not modify URL when age is any', () => {
      const filter = new JobAgeFilter('any');
      const url = 'https://www.linkedin.com/jobs/search?keywords=test';
      expect(filter.applyToUrl(url, 'linkedin')).toBe(url);
    });

    test('should apply LinkedIn age filter', () => {
      const filter = new JobAgeFilter('24h');
      const url = 'https://www.linkedin.com/jobs/search?keywords=test';
      const result = filter.applyToUrl(url, 'linkedin');
      expect(result).toContain('f_TPR=r86400');
    });

    test('should apply Indeed age filter', () => {
      const filter = new JobAgeFilter('7d');
      const url = 'https://www.indeed.com/jobs?q=test';
      const result = filter.applyToUrl(url, 'indeed');
      expect(result).toContain('fromage=7');
    });

    test('should apply Glassdoor age filter', () => {
      const filter = new JobAgeFilter('14d');
      const url = 'https://www.glassdoor.com/Job/test-jobs.htm';
      const result = filter.applyToUrl(url, 'glassdoor');
      expect(result).toContain('fromAge=14');
    });

    test('should handle unknown platform', () => {
      const filter = new JobAgeFilter('7d');
      const url = 'https://www.example.com/jobs';
      expect(filter.applyToUrl(url, 'unknown')).toBe(url);
    });
  });

  describe('applyLinkedIn', () => {
    test('should add correct TPR values', () => {
      const filter1 = new JobAgeFilter('24h');
      const filter7 = new JobAgeFilter('7d');
      const filter14 = new JobAgeFilter('14d');
      const filter30 = new JobAgeFilter('30d');
      
      const url = 'https://www.linkedin.com/jobs/search?keywords=test';
      
      expect(filter1.applyLinkedIn(url)).toContain('f_TPR=r86400');
      expect(filter7.applyLinkedIn(url)).toContain('f_TPR=r604800');
      expect(filter14.applyLinkedIn(url)).toContain('f_TPR=r1209600');
      expect(filter30.applyLinkedIn(url)).toContain('f_TPR=r2592000');
    });
  });

  describe('applyIndeed', () => {
    test('should add fromage parameter', () => {
      const filter = new JobAgeFilter('7d');
      const url = 'https://www.indeed.com/jobs?q=test';
      const result = filter.applyIndeed(url);
      expect(result).toContain('fromage=7');
    });
  });

  describe('applyGlassdoor', () => {
    test('should add fromAge parameter', () => {
      const filter = new JobAgeFilter('14d');
      const url = 'https://www.glassdoor.com/Job/test-jobs.htm';
      const result = filter.applyGlassdoor(url);
      expect(result).toContain('fromAge=14');
    });
  });
});
