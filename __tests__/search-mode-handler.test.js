const fc = require('fast-check');
const SearchModeHandler = require('../src/utils/search-mode-handler');

describe('SearchModeHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new SearchModeHandler();
  });

  describe('buildSearchQuery', () => {
    test('should add quotes for exact mode', () => {
      expect(handler.buildSearchQuery('software engineer', 'exact')).toBe('"software engineer"');
    });

    test('should not add quotes for similar mode', () => {
      expect(handler.buildSearchQuery('software engineer', 'similar')).toBe('software engineer');
    });

    test('should default to similar mode', () => {
      expect(handler.buildSearchQuery('software engineer')).toBe('software engineer');
    });
  });

  describe('linkedInHandler', () => {
    test('should add quotes for exact mode', () => {
      const result = handler.linkedInHandler('engineer', 'exact');
      expect(result.keywords).toBe('"engineer"');
      expect(result.exactMatch).toBe(true);
    });

    test('should not add quotes for similar mode', () => {
      const result = handler.linkedInHandler('engineer', 'similar');
      expect(result.keywords).toBe('engineer');
      expect(result.exactMatch).toBe(false);
    });
  });

  describe('indeedHandler', () => {
    test('should add exactphrase for exact mode', () => {
      const result = handler.indeedHandler('engineer', 'exact');
      expect(result.q).toBe('engineer');
      expect(result.exactphrase).toBe('engineer');
    });

    test('should not add exactphrase for similar mode', () => {
      const result = handler.indeedHandler('engineer', 'similar');
      expect(result.q).toBe('engineer');
      expect(result.exactphrase).toBeUndefined();
    });
  });

  describe('glassdoorHandler', () => {
    test('should add quotes for exact mode', () => {
      const result = handler.glassdoorHandler('engineer', 'exact');
      expect(result.keyword).toBe('"engineer"');
      expect(result.exactMatch).toBe(true);
    });

    test('should not add quotes for similar mode', () => {
      const result = handler.glassdoorHandler('engineer', 'similar');
      expect(result.keyword).toBe('engineer');
      expect(result.exactMatch).toBe(false);
    });
  });

  describe('adaptForPlatform', () => {
    test('should route to correct handler', () => {
      expect(handler.adaptForPlatform('test', 'exact', 'linkedin').exactMatch).toBe(true);
      expect(handler.adaptForPlatform('test', 'exact', 'indeed').exactphrase).toBe('test');
      expect(handler.adaptForPlatform('test', 'exact', 'glassdoor').exactMatch).toBe(true);
    });

    test('should throw on unsupported platform', () => {
      expect(() => handler.adaptForPlatform('test', 'exact', 'unknown')).toThrow();
    });
  });

  // Property 5: Exact Search Mode URL Generation
  describe('Property: Exact Search Mode URL Generation', () => {
    test('should add platform-specific exact match indicators', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 50 }),
          fc.constantFrom('linkedin', 'indeed', 'glassdoor'),
          (keywords, platform) => {
            const result = handler.adaptForPlatform(keywords, 'exact', platform);
            
            if (platform === 'linkedin') {
              expect(result.keywords).toContain('"');
              expect(result.exactMatch).toBe(true);
            } else if (platform === 'indeed') {
              expect(result.exactphrase).toBe(keywords);
            } else if (platform === 'glassdoor') {
              expect(result.keyword).toContain('"');
              expect(result.exactMatch).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 6: Similar Search Mode URL Generation
  describe('Property: Similar Search Mode URL Generation', () => {
    test('should not add exact match constraints', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => !s.includes('"')),
          fc.constantFrom('linkedin', 'indeed', 'glassdoor'),
          (keywords, platform) => {
            const result = handler.adaptForPlatform(keywords, 'similar', platform);
            
            if (platform === 'linkedin') {
              expect(result.keywords).toBe(keywords);
              expect(result.exactMatch).toBe(false);
            } else if (platform === 'indeed') {
              expect(result.exactphrase).toBeUndefined();
            } else if (platform === 'glassdoor') {
              expect(result.keyword).toBe(keywords);
              expect(result.exactMatch).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
