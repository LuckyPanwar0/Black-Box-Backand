const request = require('supertest');
const app = require('../index');
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require('../src/config');

let authToken;

describe('Wallet API', () => {
  beforeAll(async () => {
    const auth = await request(app)
      .post('/api/auth/login')
      .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    authToken = auth.body.token;
  });

  it('should return wallet data for authenticated user', async () => {
    const response = await request(app)
      .get('/api/wallet')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.wallet).toHaveProperty('balance');
  });

  it('should credit wallet with a unique reference', async () => {
    const reference = `test-credit-${Date.now()}`;
    const response = await request(app)
      .post('/api/wallet/credit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 10, reference, description: 'Test credit' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.wallet).toHaveProperty('balance');
  });
});
