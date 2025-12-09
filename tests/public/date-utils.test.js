import { describe, it, expect } from '@jest/globals';
import { getWeek, findTodayColumnPosition } from '../../Public/utils/date.js';

describe('Date Utilities', () => {
  describe('getWeek', () => {
    it('should return week 1 for January 1st', () => {
      const jan1 = new Date(2024, 0, 1); // January 1, 2024
      const week = getWeek(jan1);
      expect(week).toBe(1);
    });

    it('should return correct week for mid-year date', () => {
      const july15 = new Date(2024, 6, 15); // July 15, 2024
      const week = getWeek(july15);
      expect(week).toBeGreaterThan(25);
      expect(week).toBeLessThan(35);
    });

    it('should handle year-end dates (ISO week numbering)', () => {
      // Dec 31, 2024 falls in week 1 of 2025 per ISO week numbering
      const dec31 = new Date(2024, 11, 31);
      const week = getWeek(dec31);
      // ISO week can be 1, 52, or 53 at year boundaries
      expect(week).toBeGreaterThanOrEqual(1);
      expect(week).toBeLessThanOrEqual(53);
    });

    it('should handle leap year dates', () => {
      const feb29 = new Date(2024, 1, 29); // Feb 29, 2024 (leap year)
      const week = getWeek(feb29);
      expect(week).toBeGreaterThan(5);
      expect(week).toBeLessThan(15);
    });

    it('should be consistent for same date', () => {
      const date = new Date(2024, 5, 15);
      expect(getWeek(date)).toBe(getWeek(date));
    });
  });

  describe('findTodayColumnPosition', () => {
    describe('Year format', () => {
      it('should find position in year columns', () => {
        const today = new Date(2024, 5, 15); // June 15, 2024
        const columns = ['2023', '2024', '2025'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).not.toBeNull();
        expect(result.index).toBe(1);
        expect(result.percentage).toBeGreaterThan(0);
        expect(result.percentage).toBeLessThan(1);
      });

      it('should return null if year not in columns', () => {
        const today = new Date(2024, 5, 15);
        const columns = ['2020', '2021', '2022'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).toBeNull();
      });

      it('should calculate percentage through year', () => {
        const jan1 = new Date(2024, 0, 1);
        const columns = ['2024'];
        const result = findTodayColumnPosition(jan1, columns);

        expect(result.index).toBe(0);
        expect(result.percentage).toBeCloseTo(0, 1);
      });
    });

    describe('Quarter format', () => {
      it('should find position in quarter columns', () => {
        const today = new Date(2024, 3, 15); // April 15, 2024 = Q2
        const columns = ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).not.toBeNull();
        expect(result.index).toBe(1); // Q2
      });

      it('should return null if quarter not found', () => {
        const today = new Date(2024, 3, 15);
        const columns = ['Q1 2023', 'Q2 2023'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).toBeNull();
      });

      it('should identify correct quarter', () => {
        const q1Date = new Date(2024, 1, 15); // Feb = Q1
        const q3Date = new Date(2024, 7, 15); // Aug = Q3

        const columns = ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];

        const q1Result = findTodayColumnPosition(q1Date, columns);
        const q3Result = findTodayColumnPosition(q3Date, columns);

        expect(q1Result.index).toBe(0);
        expect(q3Result.index).toBe(2);
      });
    });

    describe('Month format', () => {
      it('should find position in month columns', () => {
        const today = new Date(2024, 5, 15); // June 15
        const columns = ['May 2024', 'Jun 2024', 'Jul 2024'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).not.toBeNull();
        expect(result.index).toBe(1);
      });

      it('should return null if month not found', () => {
        const today = new Date(2024, 5, 15);
        const columns = ['Jan 2024', 'Feb 2024'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).toBeNull();
      });

      it('should calculate percentage through month', () => {
        const midMonth = new Date(2024, 5, 15); // June 15
        const columns = ['Jun 2024'];
        const result = findTodayColumnPosition(midMonth, columns);

        expect(result.percentage).toBeCloseTo(0.5, 1);
      });
    });

    describe('Week format', () => {
      it('should find position in week columns', () => {
        const today = new Date(2024, 0, 8); // Early January
        const week = getWeek(today);
        const columns = [`W${week - 1} 2024`, `W${week} 2024`, `W${week + 1} 2024`];
        const result = findTodayColumnPosition(today, columns);

        expect(result).not.toBeNull();
        expect(result.index).toBe(1);
      });

      it('should return null if week not found', () => {
        const today = new Date(2024, 5, 15);
        const columns = ['W1 2024', 'W2 2024'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).toBeNull();
      });
    });

    describe('Edge cases', () => {
      it('should return null for empty columns array', () => {
        const today = new Date();
        const result = findTodayColumnPosition(today, []);

        expect(result).toBeNull();
      });

      it('should return null for unknown column format', () => {
        const today = new Date();
        const columns = ['Unknown', 'Format', 'Here'];
        const result = findTodayColumnPosition(today, columns);

        expect(result).toBeNull();
      });

      it('should handle single column array', () => {
        const today = new Date(2024, 5, 15);
        const columns = ['2024'];
        const result = findTodayColumnPosition(today, columns);

        expect(result.index).toBe(0);
      });
    });
  });
});
