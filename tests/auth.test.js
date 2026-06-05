const request = require('supertest');
const app = require('../index');
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require('../src/config');

describe('Authentication API', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should login admin with credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeDefined();
    expect(response.body.user).toHaveProperty('role');
  });
});
