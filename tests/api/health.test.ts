/**
 * API tests for GET /api/v1/health.
 *
 * The health route reads mongoose.connection.readyState at request time,
 * so we control it with Object.defineProperty — no module-level mock needed.
 * mongoose.connection.readyState is 0 (disconnected) by default in a test
 * environment where no real MongoDB is running.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns 200 with { status: "ok" } when the database is connected', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      get: () => 1,
      configurable: true,
    });

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'working sooo good', db: 'working sooo good' });
  });

  it('returns 500 with { status: "error" } when the database is not connected', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      get: () => 0,
      configurable: true,
    });

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ status: 'error', db: 'disconnected' });
  });
});
