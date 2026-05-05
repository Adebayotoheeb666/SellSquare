// __tests__/integration/kyc.flow.test.js
// Integration test for KYC flow as described in the checklist

const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');

let businessToken;
let adminToken;
let storeToken;
let kycId;

// Helper to login as business and admin
async function loginAs(role) {
  const creds = role === 'admin'
    ? { email: 'test-admin@example.com', password: 'TestAdmin123!' }
    : { email: 'test-business@example.com', password: 'TestBusiness123!' };
  const res = await request(app)
    .post('/api/business/login')
    .send(creds);
  return res.body.token;
}

describe('KYC Flow', () => {
  beforeAll(async () => {
    // Connect to test DB if needed
    // await mongoose.connect(process.env.MONGO_URI);
    businessToken = await loginAs('business');
    adminToken = await loginAs('admin');
  });

  afterAll(async () => {
    // await mongoose.disconnect();
  });

  it('Business submits KYC → status becomes submitted', async () => {
    const res = await request(app)
      .post('/api/kyc/submit')
      .set('Authorization', `Bearer ${businessToken}`)
      .send({ businessName: 'Test Biz', doc: '12345' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('submitted');
    kycId = res.body._id;
  });

  it('Admin lists KYC submissions with status filter', async () => {
    const res = await request(app)
      .get('/api/kyc/submissions?status=submitted')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ _id: kycId, status: 'submitted' })
    ]));
  });

  it('Admin approves → status becomes approved', async () => {
    const res = await request(app)
      .post(`/api/kyc/${kycId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('Business cannot generate store token until approved', async () => {
    // Simulate a new business that is not approved
    const unapprovedToken = await loginAs('business');
    const res = await request(app)
      .post('/api/kyc/generate-store-token')
      .set('Authorization', `Bearer ${unapprovedToken}`);
    expect(res.status).toBe(403);
  });

  it('Approved business generates store token → unique token stored', async () => {
    const res = await request(app)
      .post('/api/kyc/generate-store-token')
      .set('Authorization', `Bearer ${businessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    storeToken = res.body.token;
  });

  it('Second call to generate returns same token (idempotent)', async () => {
    const res = await request(app)
      .post('/api/kyc/generate-store-token')
      .set('Authorization', `Bearer ${businessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBe(storeToken);
  });

  it('Unapproved business products do NOT appear in GET /api/buyer/marketplace/products', async () => {
    const res = await request(app)
      .get('/api/buyer/marketplace/products')
      .set('Authorization', `Bearer ${businessToken}`);
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ business: expect.objectContaining({ kycStatus: 'unapproved' }) })
      ])
    );
  });

  it('Admin rejects with reason → status becomes rejected; business sees reason on Setup page', async () => {
    // Admin rejects
    const rejectRes = await request(app)
      .post(`/api/kyc/${kycId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Invalid docs' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('rejected');
    expect(rejectRes.body.reason).toBe('Invalid docs');
    // Business sees reason
    const setupRes = await request(app)
      .get('/api/kyc/setup')
      .set('Authorization', `Bearer ${businessToken}`);
    expect(setupRes.body.reason).toBe('Invalid docs');
  });
});
