const AdapterFactory = require('../src/adapters/adapter-factory');
const LinkedInAdapter = require('../src/adapters/linkedin-adapter');
const IndeedAdapter = require('../src/adapters/indeed-adapter');
const GlassdoorAdapter = require('../src/adapters/glassdoor-adapter');

describe('AdapterFactory', () => {
  describe('createAdapter', () => {
    test('should create LinkedIn adapter from URL', () => {
      const adapter = AdapterFactory.createAdapter('https://www.linkedin.com/jobs/search');
      expect(adapter).toBeInstanceOf(LinkedInAdapter);
      expect(adapter.siteName).toBe('linkedin');
    });

    test('should create Indeed adapter from URL', () => {
      const adapter = AdapterFactory.createAdapter('https://www.indeed.com/jobs');
      expect(adapter).toBeInstanceOf(IndeedAdapter);
      expect(adapter.siteName).toBe('indeed');
    });

    test('should create Glassdoor adapter from URL', () => {
      const adapter = AdapterFactory.createAdapter('https://www.glassdoor.com/Job/jobs.htm');
      expect(adapter).toBeInstanceOf(GlassdoorAdapter);
      expect(adapter.siteName).toBe('glassdoor');
    });

    test('should create adapter from site name', () => {
      const adapter = AdapterFactory.createAdapter('linkedin');
      expect(adapter).toBeInstanceOf(LinkedInAdapter);
    });

    test('should throw on unsupported site', () => {
      expect(() => {
        AdapterFactory.createAdapter('https://www.monster.com');
      }).toThrow('Unknown job site');
    });

    test('should throw on invalid input', () => {
      expect(() => {
        AdapterFactory.createAdapter(null);
      }).toThrow('Site name or URL is required');
    });
  });

  describe('getSupportedSites', () => {
    test('should return all supported sites', () => {
      const sites = AdapterFactory.getSupportedSites();
      expect(sites).toEqual(['linkedin', 'indeed', 'glassdoor']);
    });
  });

  describe('isSiteSupported', () => {
    test('should return true for supported sites', () => {
      expect(AdapterFactory.isSiteSupported('linkedin')).toBe(true);
      expect(AdapterFactory.isSiteSupported('indeed')).toBe(true);
      expect(AdapterFactory.isSiteSupported('glassdoor')).toBe(true);
    });

    test('should return false for unsupported sites', () => {
      expect(AdapterFactory.isSiteSupported('monster')).toBe(false);
      expect(AdapterFactory.isSiteSupported('invalid')).toBe(false);
    });
  });
});
