/**
 * Tests for Case Conversion Utilities
 *
 * @author Claude Code - Performance Optimization
 */

import { describe, it, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  toSnakeCaseKeys,
  toCamelCaseKeys,
  mapFieldToSnake,
  FIELD_MAP,
} from '../../../lib/caseConvert';

describe('lib/caseConvert - Case Conversion Utilities', () => {
  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('managerEmail')).toBe('manager_email');
      expect(toSnakeCase('clientName')).toBe('client_name');
      expect(toSnakeCase('createdAt')).toBe('created_at');
    });

    it('should handle already lowercase strings', () => {
      expect(toSnakeCase('email')).toBe('email');
      expect(toSnakeCase('name')).toBe('name');
    });

    it('should handle multiple capitals', () => {
      expect(toSnakeCase('isIndexedDBRef')).toBe('is_indexed_d_b_ref');
      expect(toSnakeCase('userID')).toBe('user_i_d');
    });

    it('should handle empty string', () => {
      expect(toSnakeCase('')).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('manager_email')).toBe('managerEmail');
      expect(toCamelCase('client_name')).toBe('clientName');
      expect(toCamelCase('created_at')).toBe('createdAt');
    });

    it('should handle already camelCase strings', () => {
      expect(toCamelCase('email')).toBe('email');
      expect(toCamelCase('name')).toBe('name');
    });

    it('should handle multiple underscores', () => {
      expect(toCamelCase('some_long_field_name')).toBe('someLongFieldName');
    });

    it('should handle empty string', () => {
      expect(toCamelCase('')).toBe('');
    });
  });

  describe('toSnakeCaseKeys', () => {
    it('should convert object keys to snake_case', () => {
      const input = {
        managerEmail: 'test@example.com',
        clientName: 'John Doe',
        createdAt: '2024-01-01',
      };

      const result = toSnakeCaseKeys(input);

      expect(result).toEqual({
        manager_email: 'test@example.com',
        client_name: 'John Doe',
        created_at: '2024-01-01',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        jobData: {
          clientEmail: 'client@example.com',
          managerEmail: 'manager@example.com',
        },
      };

      const result = toSnakeCaseKeys(input);

      expect(result).toEqual({
        job_data: {
          client_email: 'client@example.com',
          manager_email: 'manager@example.com',
        },
      });
    });

    it('should handle arrays', () => {
      const input = {
        photos: [
          { photoId: '1', jobId: 'JOB-1' },
          { photoId: '2', jobId: 'JOB-1' },
        ],
      };

      const result = toSnakeCaseKeys(input);

      expect(result).toEqual({
        photos: [
          { photo_id: '1', job_id: 'JOB-1' },
          { photo_id: '2', job_id: 'JOB-1' },
        ],
      });
    });

    it('should handle null and undefined values', () => {
      const input = {
        managerEmail: null,
        clientName: undefined,
        notes: 'Some notes',
      };

      const result = toSnakeCaseKeys(input);

      expect(result).toEqual({
        manager_email: null,
        client_name: undefined,
        notes: 'Some notes',
      });
    });

    it('should return non-object values as-is', () => {
      expect(toSnakeCaseKeys(null as any)).toBe(null);
      expect(toSnakeCaseKeys('string' as any)).toBe('string');
      expect(toSnakeCaseKeys(123 as any)).toBe(123);
    });
  });

  describe('toCamelCaseKeys', () => {
    it('should convert object keys to camelCase', () => {
      const input = {
        manager_email: 'test@example.com',
        client_name: 'John Doe',
        created_at: '2024-01-01',
      };

      const result = toCamelCaseKeys(input);

      expect(result).toEqual({
        managerEmail: 'test@example.com',
        clientName: 'John Doe',
        createdAt: '2024-01-01',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        job_data: {
          client_email: 'client@example.com',
          manager_email: 'manager@example.com',
        },
      };

      const result = toCamelCaseKeys(input);

      expect(result).toEqual({
        jobData: {
          clientEmail: 'client@example.com',
          managerEmail: 'manager@example.com',
        },
      });
    });

    it('should handle arrays', () => {
      const input = {
        photos: [
          { photo_id: '1', job_id: 'JOB-1' },
          { photo_id: '2', job_id: 'JOB-1' },
        ],
      };

      const result = toCamelCaseKeys(input);

      expect(result).toEqual({
        photos: [
          { photoId: '1', jobId: 'JOB-1' },
          { photoId: '2', jobId: 'JOB-1' },
        ],
      });
    });
  });

  describe('mapFieldToSnake', () => {
    it('should use FIELD_MAP for known fields', () => {
      expect(mapFieldToSnake('managerEmail')).toBe('manager_email');
      expect(mapFieldToSnake('clientEmail')).toBe('client_email');
      expect(mapFieldToSnake('createdAt')).toBe('created_at');
    });

    it('should fall back to automatic conversion for unknown fields', () => {
      expect(mapFieldToSnake('customField')).toBe('custom_field');
      expect(mapFieldToSnake('someNewProperty')).toBe('some_new_property');
    });
  });

  describe('FIELD_MAP', () => {
    it('should have common job fields mapped', () => {
      expect(FIELD_MAP.jobId).toBe('job_id');
      expect(FIELD_MAP.managerEmail).toBe('manager_email');
      expect(FIELD_MAP.clientEmail).toBe('client_email');
      expect(FIELD_MAP.createdAt).toBe('created_at');
      expect(FIELD_MAP.updatedAt).toBe('updated_at');
    });

    it('should have auth fields mapped', () => {
      expect(FIELD_MAP.userId).toBe('user_id');
      expect(FIELD_MAP.workspaceId).toBe('workspace_id');
    });
  });
});
