import request from 'supertest';
import app from '../app';

describe('Health endpoint', () => {
  it('returns 200 OK for /api/test-health', async () => {
    const res = await request(app).get('/api/test-health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
