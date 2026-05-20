/**
 * E2E tests for Prayer Time calculation module
 *
 * Uses supertest to hit the actual API endpoints.
 * Uses mongodb-memory-server for clean database connectivity during app bootstrap.
 * Calculates Salat times dynamically offline.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { logApi } from '../../../../helpers/__tests__/testLogger';

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Prayer Time E2E Tests', () => {
  describe('GET /api/v1/prayer-times', () => {
    it('successfully retrieves prayer times for Dhaka (default parameters)', async () => {
      const query = {
        latitude: '23.8103',
        longitude: '90.4125',
      };

      const response = await request(app)
        .get('/api/v1/prayer-times')
        .query(query);

      logApi('GET', '/api/v1/prayer-times', {
        params: {},
        query,
        body: {},
      }, response.body, undefined, 'successfully retrieves prayer times for Dhaka (default parameters)');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.weekday).toBeDefined();
      expect(response.body.data.hijriDate).toBeDefined();
      // Ensure hijriDate doesn't contain Gregorian month names if possible
      const gregorianMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const containsGregorian = gregorianMonths.some(month => response.body.data.hijriDate.includes(month));
      expect(containsGregorian).toBe(false);
      expect(response.body.data.location).toBe('Dhaka, Bangladesh');
      
      // Verify all timings are present and formatted correctly (HH:MM)
      const timings = response.body.data.timings;
      expect(timings).toBeDefined();
      const timeRegex = /^[0-9]{2}:[0-9]{2}$/;
      expect(timings.fajr).toMatch(timeRegex);
      expect(timings.sunrise).toMatch(timeRegex);
      expect(timings.dhuhr).toMatch(timeRegex);
      expect(timings.asr).toMatch(timeRegex);
      expect(timings.maghrib).toMatch(timeRegex);
      expect(timings.isha).toMatch(timeRegex);
    });

    it('successfully calculates using custom method, madhab, date, and timezone', async () => {
      const query = {
        latitude: '40.7128',
        longitude: '-74.0060',
        date: '2026-06-15',
        method: 'isna',
        madhab: 'Shafi',
        timezone: 'America/New_York',
      };

      const response = await request(app)
        .get('/api/v1/prayer-times')
        .query(query);

      logApi('GET', '/api/v1/prayer-times', {
        params: {},
        query,
        body: {},
      }, response.body, 'CUSTOM_PARAMS', 'successfully calculates using custom method, madhab, date, and timezone');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.location).toBe('New York');

      const timings = response.body.data.timings;
      expect(timings).toBeDefined();
      const timeRegex = /^[0-9]{2}:[0-9]{2}$/;
      expect(timings.fajr).toMatch(timeRegex);
      expect(timings.sunrise).toMatch(timeRegex);
    });

    it('returns jummah timing when the date is a Friday', async () => {
      const query = {
        latitude: '23.8103',
        longitude: '90.4125',
        date: '2026-06-12', // June 12, 2026 is a Friday
      };

      const response = await request(app)
        .get('/api/v1/prayer-times')
        .query(query);

      logApi('GET', '/api/v1/prayer-times', {
        params: {},
        query,
        body: {},
      }, response.body, 'FRIDAY_JUMMAH', 'returns jummah timing when the date is a Friday');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timings.jummah).toBeDefined();
      expect(response.body.data.timings.jummah).toBe(response.body.data.timings.dhuhr);
    });

    it('returns 400 bad request when latitude is missing', async () => {
      const query = {
        longitude: '90.4125',
      };

      const response = await request(app)
        .get('/api/v1/prayer-times')
        .query(query);

      logApi('GET', '/api/v1/prayer-times', {
        params: {},
        query,
        body: {},
      }, response.body, 'MISSING_LATITUDE', 'returns 400 bad request when latitude is missing');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation Error');
    });

    it('returns 400 bad request when coordinates are out of bounds', async () => {
      const query = {
        latitude: '120.0', // Out of bounds (-90 to 90)
        longitude: '90.4125',
      };

      const response = await request(app)
        .get('/api/v1/prayer-times')
        .query(query);

      logApi('GET', '/api/v1/prayer-times', {
        params: {},
        query,
        body: {},
      }, response.body, 'OUT_OF_BOUNDS', 'returns 400 bad request when coordinates are out of bounds');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation Error');
    });

    it('returns 400 bad request when an invalid date is sent', async () => {
      const query = {
        latitude: '23.8103',
        longitude: '90.4125',
        date: 'not-a-valid-date',
      };

      const response = await request(app)
        .get('/api/v1/prayer-times')
        .query(query);

      logApi('GET', '/api/v1/prayer-times', {
        params: {},
        query,
        body: {},
      }, response.body, 'INVALID_DATE', 'returns 400 bad request when an invalid date is sent');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation Error');
    });

    it('returns 400 bad request when an invalid madhab is sent', async () => {
      const query = {
        latitude: '23.8103',
        longitude: '90.4125',
        madhab: 'invalid-madhab',
      };

      const response = await request(app)
        .get('/api/v1/prayer-times')
        .query(query);

      logApi('GET', '/api/v1/prayer-times', {
        params: {},
        query,
        body: {},
      }, response.body, 'INVALID_MADHAB', 'returns 400 bad request when an invalid madhab is sent');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation Error');
    });
  });
});
