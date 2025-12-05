const fc = require('fast-check');
const PlatformFilter = require('../src/utils/platform-filter');

describe('PlatformFilter', () => {
  describe('constructor', () => {
    test('should default to all platforms', () => {
      const filter = new PlatformFilter();
      expect(filter.getEnabledPlatforms()).toEqual(['linkedin', 'indeed', 'glassdoor']);
    });

    test('should accept custom platforms', () => {
      const filter = new PlatformFilter(['linkedin', 'indeed']);
      expect(filter.getEnabledPlatforms()).toEqual(['linkedin', 'indeed']);
    });

    test('should normalize to lowercase', () => {
      const filter = new PlatformFilter(['LinkedIn', 'INDEED']);
      expect(filter.getEnabledPlatforms()).toEqual(['linkedin', 'indeed']);
    });
  });

  describe('isEnabled', () => {
    test('should return true for enabled platforms', () => {
      const filter = new PlatformFilter(['linkedin', 'indeed']);
      expect(filter.isEnabled('linkedin')).toBe(true);
      expect(filter.isEnabled('indeed')).toBe(true);
    });

    test('should return false for disabled platforms', () => {
      const filter = new PlatformFilter(['linkedin']);
      expect(filter.isEnabled('indeed')).toBe(false);
      expect(filter.isEnabled('glassdoor')).toBe(false);
    });

    test('should be case-insensitive', () => {
      const filter = new PlatformFilter(['linkedin']);
      expect(filter.isEnabled('LinkedIn')).toBe(true);
      expect(filter.isEnabled('LINKEDIN')).toBe(true);
    });
  });

  describe('detectPlatform', () => {
    test('should detect LinkedIn', () => {
      const filter = new PlatformFilter();
      expect(filter.detectPlatform('https://www.linkedin.com/jobs/search')).toBe('linkedin');
    });

    test('should detect Indeed', () => {
      const filter = new PlatformFilter();
      expect(filter.detectPlatform('https://www.indeed.com/jobs')).toBe('indeed');
    });

    test('should detect Glassdoor', () => {
      const filter = new PlatformFilter();
      expect(filter.detectPlatform('https://www.glassdoor.com/Job')).toBe('glassdoor');
    });

    test('should return null for unknown URLs', () => {
      const filter = new PlatformFilter();
      expect(filter.detectPlatform('https://www.example.com')).toBe(null);
    });

    test('should be case-insensitive', () => {
      const filter = new PlatformFilter();
      expect(filter.detectPlatform('https://www.LINKEDIN.com/jobs')).toBe('linkedin');
    });
  });

  describe('filterUrls', () => {
    test('should filter URLs by enabled platforms', () => {
      const filter = new PlatformFilter(['linkedin', 'indeed']);
      const urls = [
        'https://www.linkedin.com/jobs/search',
        'https://www.indeed.com/jobs',
        'https://www.glassdoor.com/Job'
      ];
      
      const result = filter.filterUrls(urls);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('linkedin');
      expect(result[1]).toContain('indeed');
    });

    test('should handle empty array', () => {
      const filter = new PlatformFilter(['linkedin']);
      expect(filter.filterUrls([])).toEqual([]);
    });

    test('should filter out unknown URLs', () => {
      const filter = new PlatformFilter(['linkedin']);
      const urls = [
        'https://www.linkedin.com/jobs',
        'https://www.example.com'
      ];
      
      const result = filter.filterUrls(urls);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('linkedin');
    });
  });

  // Property 8: Platform Selection Filtering
  describe('Property: Platform Selection Filtering', () => {
    test('should keep only selected platforms URLs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('linkedin', 'indeed', 'glassdoor'),
            { minLength: 1, maxLength: 3 }
          ),
          (selectedPlatforms) => {
            const filter = new PlatformFilter(selectedPlatforms);
            
            // Generate URLs for all platforms
            const allUrls = [
              'https://www.linkedin.com/jobs/search?keywords=test',
              'https://www.indeed.com/jobs?q=test',
              'https://www.glassdoor.com/Job/test-jobs.htm'
            ];
            
            const filtered = filter.filterUrls(allUrls);
            
            // Verify only selected platforms remain
            for (const url of filtered) {
              const platform = filter.detectPlatform(url);
              expect(selectedPlatforms.map(p => p.toLowerCase())).toContain(platform);
            }
            
            // Verify no unselected platforms remain
            const allPlatforms = ['linkedin', 'indeed', 'glassdoor'];
            const unselectedPlatforms = allPlatforms.filter(
              p => !selectedPlatforms.map(s => s.toLowerCase()).includes(p)
            );
            
            for (const url of filtered) {
              const platform = filter.detectPlatform(url);
              expect(unselectedPlatforms).not.toContain(platform);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getEnabledPlatforms', () => {
    test('should return copy of enabled platforms', () => {
      const filter = new PlatformFilter(['linkedin']);
      const platforms = filter.getEnabledPlatforms();
      
      platforms.push('indeed');
      
      expect(filter.getEnabledPlatforms()).toEqual(['linkedin']);
    });
  });
});
