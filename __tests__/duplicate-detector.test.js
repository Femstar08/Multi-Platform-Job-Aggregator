const fc = require('fast-check');
const DuplicateDetector = require('../src/utils/duplicate-detector');

describe('DuplicateDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new DuplicateDetector();
  });

  describe('normalizeTitle', () => {
    test('should handle normal case', () => {
      expect(detector.normalizeTitle('Senior Software Engineer')).toBe('senior software engineer');
    });

    test('should remove punctuation', () => {
      expect(detector.normalizeTitle('Software Engineer - Full Stack')).toBe('software engineer full stack');
    });

    test('should handle null', () => {
      expect(detector.normalizeTitle(null)).toBe('');
    });
  });

  describe('normalizeCompany', () => {
    test('should handle normal case', () => {
      expect(detector.normalizeCompany('Google Inc.')).toBe('google');
    });

    test('should remove company suffixes', () => {
      expect(detector.normalizeCompany('Microsoft Corporation')).toBe('microsoft');
      expect(detector.normalizeCompany('Apple LLC')).toBe('apple');
    });

    test('should handle null', () => {
      expect(detector.normalizeCompany(null)).toBe('');
    });
  });

  describe('normalizeLocation', () => {
    test('should handle normal case', () => {
      expect(detector.normalizeLocation('San Francisco, CA')).toBe('san francisco ca');
    });

    test('should remove work mode keywords', () => {
      expect(detector.normalizeLocation('Remote - San Francisco')).toBe(' san francisco');
    });

    test('should handle null', () => {
      expect(detector.normalizeLocation(null)).toBe('');
    });
  });

  describe('generateFingerprint', () => {
    test('should generate consistent fingerprints', () => {
      const job1 = { title: 'Engineer', company: 'Google', location: 'SF' };
      const job2 = { title: 'Engineer', company: 'Google', location: 'SF' };
      
      expect(detector.generateFingerprint(job1)).toBe(detector.generateFingerprint(job2));
    });

    test('should generate different fingerprints for different jobs', () => {
      const job1 = { title: 'Engineer', company: 'Google', location: 'SF' };
      const job2 = { title: 'Engineer', company: 'Facebook', location: 'SF' };
      
      expect(detector.generateFingerprint(job1)).not.toBe(detector.generateFingerprint(job2));
    });
  });

  // Property 1: Duplicate Detection Consistency
  describe('Property: Duplicate Detection Consistency', () => {
    test('should mark jobs with same normalized title+company+location as duplicates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 50 }),
              company: fc.string({ minLength: 3, maxLength: 30 }),
              location: fc.string({ minLength: 3, maxLength: 30 }),
              source: fc.constantFrom('linkedin', 'indeed', 'glassdoor')
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (jobs) => {
            const result = detector.detectDuplicates(jobs);
            
            // Group by fingerprint
            const fingerprintGroups = new Map();
            for (const job of result) {
              if (!fingerprintGroups.has(job._fingerprint)) {
                fingerprintGroups.set(job._fingerprint, []);
              }
              fingerprintGroups.get(job._fingerprint).push(job);
            }
            
            // Verify each group
            for (const [fingerprint, group] of fingerprintGroups) {
              if (group.length > 1) {
                // First should be original
                expect(group[0]._isDuplicate).toBe(false);
                expect(group[0]._duplicateOf).toBe(null);
                
                // Rest should be duplicates
                for (let i = 1; i < group.length; i++) {
                  expect(group[i]._isDuplicate).toBe(true);
                  expect(group[i]._duplicateOf).toBe(group[0].id);
                }
                
                // Original should have all sources
                const allSources = group.map(j => j.source);
                for (const source of allSources) {
                  expect(group[0].sources).toContain(source);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 2: Duplicate Removal Completeness
  describe('Property: Duplicate Removal Completeness', () => {
    test('should remove all jobs marked as duplicates', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 50 }),
              company: fc.string({ minLength: 3, maxLength: 30 }),
              location: fc.string({ minLength: 3, maxLength: 30 }),
              source: fc.constantFrom('linkedin', 'indeed', 'glassdoor')
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (jobs) => {
            const detected = detector.detectDuplicates(jobs);
            const filtered = detector.removeDuplicates(detected);
            
            // All remaining jobs should have _isDuplicate: false
            for (const job of filtered) {
              expect(job._isDuplicate).toBe(false);
            }
            
            // No duplicates should remain
            const duplicateCount = detected.filter(j => j._isDuplicate).length;
            expect(filtered.length).toBe(detected.length - duplicateCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 10: Fingerprint Uniqueness for Distinct Jobs
  describe('Property: Fingerprint Uniqueness for Distinct Jobs', () => {
    test('should generate different fingerprints for jobs with different title, company, or location', () => {
      fc.assert(
        fc.property(
          fc.record({
            title1: fc.string({ minLength: 5, maxLength: 50 }),
            title2: fc.string({ minLength: 5, maxLength: 50 }),
            company1: fc.string({ minLength: 3, maxLength: 30 }),
            company2: fc.string({ minLength: 3, maxLength: 30 }),
            location1: fc.string({ minLength: 3, maxLength: 30 }),
            location2: fc.string({ minLength: 3, maxLength: 30 })
          }),
          (data) => {
            const job1 = { title: data.title1, company: data.company1, location: data.location1 };
            const job2 = { title: data.title2, company: data.company2, location: data.location2 };
            
            const fp1 = detector.generateFingerprint(job1);
            const fp2 = detector.generateFingerprint(job2);
            
            // If any field differs after normalization, fingerprints should differ
            const norm1 = {
              title: detector.normalizeTitle(data.title1),
              company: detector.normalizeCompany(data.company1),
              location: detector.normalizeLocation(data.location1)
            };
            const norm2 = {
              title: detector.normalizeTitle(data.title2),
              company: detector.normalizeCompany(data.company2),
              location: detector.normalizeLocation(data.location2)
            };
            
            if (norm1.title !== norm2.title || 
                norm1.company !== norm2.company || 
                norm1.location !== norm2.location) {
              expect(fp1).not.toBe(fp2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('detectDuplicates', () => {
    test('should handle empty array', () => {
      expect(detector.detectDuplicates([])).toEqual([]);
    });

    test('should mark duplicates correctly', () => {
      const jobs = [
        { id: '1', title: 'Engineer', company: 'Google Inc.', location: 'SF', source: 'linkedin' },
        { id: '2', title: 'Engineer', company: 'Google', location: 'SF', source: 'indeed' },
        { id: '3', title: 'Designer', company: 'Apple', location: 'NY', source: 'glassdoor' }
      ];
      
      const result = detector.detectDuplicates(jobs);
      
      expect(result[0]._isDuplicate).toBe(false);
      expect(result[1]._isDuplicate).toBe(true);
      expect(result[1]._duplicateOf).toBe('1');
      expect(result[0].sources).toEqual(['linkedin', 'indeed']);
      expect(result[2]._isDuplicate).toBe(false);
    });
  });

  describe('removeDuplicates', () => {
    test('should remove duplicates', () => {
      const jobs = [
        { id: '1', _isDuplicate: false },
        { id: '2', _isDuplicate: true },
        { id: '3', _isDuplicate: false }
      ];
      
      const result = detector.removeDuplicates(jobs);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
    });
  });
});
