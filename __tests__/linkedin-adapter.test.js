const LinkedInAdapter = require('../src/adapters/linkedin-adapter');

describe('LinkedInAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new LinkedInAdapter();
  });

  describe('isValidUrl', () => {
    test('should validate LinkedIn URLs', () => {
      expect(adapter.isValidUrl('https://www.linkedin.com/jobs/search')).toBe(true);
      expect(adapter.isValidUrl('https://linkedin.com/jobs/view/123')).toBe(true);
    });

    test('should reject non-LinkedIn URLs', () => {
      expect(adapter.isValidUrl('https://www.indeed.com')).toBe(false);
    });
  });

  describe('buildSearchUrl', () => {
    test('should build search URL with query and location', () => {
      const url = adapter.buildSearchUrl('software engineer', 'San Francisco');
      expect(url).toContain('linkedin.com/jobs/search');
      expect(url).toContain('keywords=software+engineer');
      expect(url).toContain('location=San+Francisco');
    });

    test('should handle pagination', () => {
      const url = adapter.buildSearchUrl('developer', 'NYC', 2);
      expect(url).toContain('start=50');
    });
  });

  describe('buildPageUrl', () => {
    test('should add pagination to existing URL', () => {
      const baseUrl = 'https://www.linkedin.com/jobs/search/?keywords=test';
      const pageUrl = adapter.buildPageUrl(baseUrl, 3);
      expect(pageUrl).toContain('start=75');
    });
  });

  describe('normalizeData', () => {
    test('should normalize job data to unified schema', () => {
      const rawData = {
        id: '123',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco',
        url: 'https://linkedin.com/jobs/view/123',
        salary: '$120,000 - $180,000',
        applicantCount: 50
      };

      const normalized = adapter.normalizeData(rawData);

      expect(normalized.id).toBe('123');
      expect(normalized.source).toBe('linkedin');
      expect(normalized.title).toBe('Software Engineer');
      expect(normalized.salary.min).toBe(120000);
      expect(normalized.salary.max).toBe(180000);
      expect(normalized.salary.currency).toBe('USD');
      expect(normalized._site).toBe('linkedin');
      expect(normalized._scrapedAt).toBeDefined();
    });

    test('should handle missing salary', () => {
      const rawData = {
        id: '123',
        title: 'Engineer',
        company: 'Corp',
        url: 'https://linkedin.com/jobs/view/123'
      };

      const normalized = adapter.normalizeData(rawData);
      expect(normalized.salary.min).toBeNull();
      expect(normalized.salary.max).toBeNull();
    });
  });

  describe('_parseSalary', () => {
    test('should parse salary range', () => {
      const result = adapter._parseSalary('$100,000 - $150,000');
      expect(result.min).toBe(100000);
      expect(result.max).toBe(150000);
      expect(result.currency).toBe('USD');
    });

    test('should detect hourly rate', () => {
      const result = adapter._parseSalary('$50 - $75 per hour');
      expect(result.period).toBe('hour');
    });

    test('should handle null salary', () => {
      const result = adapter._parseSalary(null);
      expect(result.min).toBeNull();
    });
  });
});
