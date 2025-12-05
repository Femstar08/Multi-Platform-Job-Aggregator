const fc = require('fast-check');
const ExpirationDetector = require('../src/utils/expiration-detector');

describe('ExpirationDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new ExpirationDetector();
  });

  describe('calculateAge', () => {
    test('should calculate age correctly', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      expect(detector.calculateAge(yesterday)).toBe(1);
    });

    test('should return null for invalid date', () => {
      expect(detector.calculateAge('invalid')).toBe(null);
    });

    test('should return null for null', () => {
      expect(detector.calculateAge(null)).toBe(null);
    });

    test('should return null for future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      expect(detector.calculateAge(tomorrow)).toBe(null);
    });
  });

  describe('isExpired', () => {
    test('should detect expired jobs', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      
      const job = { postedDate: oldDate };
      
      expect(detector.isExpired(job, 30)).toBe(true);
    });

    test('should not mark recent jobs as expired', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      
      const job = { postedDate: recentDate };
      
      expect(detector.isExpired(job, 30)).toBe(false);
    });

    test('should not mark jobs without dates as expired', () => {
      const job = { postedDate: null };
      
      expect(detector.isExpired(job, 30)).toBe(false);
    });
  });

  // Property 3: Expiration Detection Accuracy
  describe('Property: Expiration Detection Accuracy', () => {
    test('should mark jobs as expired iff age > threshold', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string(),
              daysAgo: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 60 }),
          (jobData, threshold) => {
            const jobs = jobData.map(data => {
              const date = new Date();
              date.setDate(date.getDate() - data.daysAgo);
              return {
                ...data,
                postedDate: date.toISOString()
              };
            });
            
            const result = detector.markExpiration(jobs, threshold);
            
            for (let i = 0; i < result.length; i++) {
              const job = result[i];
              const expectedExpired = jobData[i].daysAgo > threshold;
              
              expect(job._isExpired).toBe(expectedExpired);
              expect(job._ageInDays).toBe(jobData[i].daysAgo);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 4: Expired Job Filtering
  describe('Property: Expired Job Filtering', () => {
    test('should remove all jobs where _isExpired is true', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string(),
              daysAgo: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 60 }),
          (jobData, threshold) => {
            const jobs = jobData.map(data => {
              const date = new Date();
              date.setDate(date.getDate() - data.daysAgo);
              return {
                ...data,
                postedDate: date.toISOString()
              };
            });
            
            const marked = detector.markExpiration(jobs, threshold);
            const filtered = detector.filterExpired(marked);
            
            // All remaining jobs should not be expired
            for (const job of filtered) {
              expect(job._isExpired).toBe(false);
            }
            
            // Count should match
            const expiredCount = marked.filter(j => j._isExpired).length;
            expect(filtered.length).toBe(marked.length - expiredCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 7: Job Age Filtering Accuracy
  describe('Property: Job Age Filtering Accuracy', () => {
    test('should keep only jobs where _ageInDays <= maxAge or _ageInDays is null', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string(),
              daysAgo: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 60 }),
          (jobData, maxAge) => {
            const jobs = jobData.map(data => {
              if (data.daysAgo === null) {
                return {
                  ...data,
                  postedDate: null,
                  _ageInDays: null
                };
              }
              
              const date = new Date();
              date.setDate(date.getDate() - data.daysAgo);
              return {
                ...data,
                postedDate: date.toISOString(),
                _ageInDays: data.daysAgo
              };
            });
            
            const filtered = detector.filterByAge(jobs, maxAge);
            
            for (const job of filtered) {
              if (job._ageInDays !== null) {
                expect(job._ageInDays).toBeLessThanOrEqual(maxAge);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 11: Age Calculation Monotonicity
  describe('Property: Age Calculation Monotonicity', () => {
    test('should have age at T2 >= age at T1 when T2 > T1', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date() }),
          (postedDate) => {
            // Calculate age at T1 (now)
            const ageT1 = detector.calculateAge(postedDate);
            
            // Wait a tiny bit (simulate time passing)
            // In practice, we'll just add 1 day to the posted date to simulate aging
            const olderPostedDate = new Date(postedDate);
            olderPostedDate.setDate(olderPostedDate.getDate() - 1);
            
            // Calculate age at T2 (for an older posted date, which means more age)
            const ageT2 = detector.calculateAge(olderPostedDate);
            
            if (ageT1 !== null && ageT2 !== null) {
              expect(ageT2).toBeGreaterThanOrEqual(ageT1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('markExpiration', () => {
    test('should add expiration metadata', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      
      const jobs = [
        { id: '1', postedDate: oldDate },
        { id: '2', postedDate: recentDate },
        { id: '3', postedDate: null }
      ];
      
      const result = detector.markExpiration(jobs, 30);
      
      expect(result[0]._isExpired).toBe(true);
      expect(result[0]._ageInDays).toBe(40);
      expect(result[1]._isExpired).toBe(false);
      expect(result[1]._ageInDays).toBe(10);
      expect(result[2]._isExpired).toBe(false);
      expect(result[2]._ageInDays).toBe(null);
    });
  });

  describe('filterExpired', () => {
    test('should remove expired jobs', () => {
      const jobs = [
        { id: '1', _isExpired: false },
        { id: '2', _isExpired: true },
        { id: '3', _isExpired: false }
      ];
      
      const result = detector.filterExpired(jobs);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
    });
  });

  describe('filterByAge', () => {
    test('should filter by age', () => {
      const jobs = [
        { id: '1', _ageInDays: 5 },
        { id: '2', _ageInDays: 15 },
        { id: '3', _ageInDays: 25 },
        { id: '4', _ageInDays: null }
      ];
      
      const result = detector.filterByAge(jobs, 20);
      
      expect(result).toHaveLength(3);
      expect(result.map(j => j.id)).toEqual(['1', '2', '4']);
    });
  });
});
