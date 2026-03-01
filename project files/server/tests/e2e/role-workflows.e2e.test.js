const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../helpers/testSetup');

let harness;

before(async () => {
  harness = await createHarness();
});

after(async () => {
  await harness.shutdown();
});

test('E2E: user full purchase flow (online payment -> confirmed)', async () => {
  const buyer = await harness.helpers.mkUser({
    name: 'E2E Buyer',
    email: 'e2e.buyer@example.com',
    phone: '+16660001001'
  });
  const seller = await harness.helpers.mkUser({
    name: 'E2E Seller',
    email: 'e2e.seller@example.com',
    phone: '+16660001002',
    role: 'SELLER'
  });
  const { productA } = await harness.helpers.seedCatalogForSellers({
    sellerAId: seller._id,
    sellerBId: seller._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: buyer._id,
    items: [{ productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 }]
  });

  const buyerLogin = await harness.helpers.login({ email: buyer.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'E2E Buyer',
        phone: '+16660001001',
        line1: '1 Test Lane',
        line2: '',
        city: 'Bangalore',
        state: 'KA',
        pincode: '560001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'ONLINE'
    });
  assert.equal(place.status, 201);

  const orderId = place.body.data.orderIds[0];
  const gateway = await harness.request
    .post('/api/payments/create-order')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({ orderId });
  assert.equal(gateway.status, 200);

  const capture = await harness.request.post('/api/payments/webhook').send({
    event: 'payment.captured',
    externalOrderId: gateway.body.data.externalOrderId,
    externalPaymentId: `pay_${orderId}`
  });
  assert.equal(capture.status, 200);

  const order = await harness.request
    .get(`/api/orders/${orderId}`)
    .set(harness.helpers.authHeader(buyerLogin.accessToken));
  assert.equal(order.status, 200);
  assert.equal(order.body.data.orderStatus, 'CONFIRMED');
});

test('E2E: seller fulfillment flow (processing -> packed -> shipped)', async () => {
  const buyer = await harness.helpers.mkUser({
    name: 'E2E Buyer 2',
    email: 'e2e.buyer2@example.com',
    phone: '+16660001003'
  });
  const seller = await harness.helpers.mkUser({
    name: 'E2E Seller 2',
    email: 'e2e.seller2@example.com',
    phone: '+16660001004',
    role: 'SELLER'
  });
  const { productA } = await harness.helpers.seedCatalogForSellers({
    sellerAId: seller._id,
    sellerBId: seller._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: buyer._id,
    items: [{ productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 }]
  });

  const buyerLogin = await harness.helpers.login({ email: buyer.email });
  const sellerLogin = await harness.helpers.login({ email: seller.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'E2E Buyer 2',
        phone: '+16660001003',
        line1: '2 Test Lane',
        line2: '',
        city: 'Pune',
        state: 'MH',
        pincode: '411001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'COD'
    });
  const orderId = place.body.data.orderIds[0];

  const p = await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(sellerLogin.accessToken))
    .send({ nextStatus: 'PROCESSING' });
  assert.equal(p.status, 200);

  const packed = await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(sellerLogin.accessToken))
    .send({ nextStatus: 'PACKED' });
  assert.equal(packed.status, 200);

  const shipped = await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(sellerLogin.accessToken))
    .send({ nextStatus: 'SHIPPED', trackingId: 'SHIP-E2E-001' });
  assert.equal(shipped.status, 200);
  assert.equal(shipped.body.data.orderStatus, 'SHIPPED');
});

test('E2E: admin refund flow (cancelled paid order -> initiated -> refunded)', async () => {
  const admin = await harness.helpers.mkUser({
    name: 'E2E Admin',
    email: 'e2e.admin@example.com',
    phone: '+16660001005',
    role: 'ADMIN'
  });
  const buyer = await harness.helpers.mkUser({
    name: 'E2E Buyer 3',
    email: 'e2e.buyer3@example.com',
    phone: '+16660001006'
  });
  const seller = await harness.helpers.mkUser({
    name: 'E2E Seller 3',
    email: 'e2e.seller3@example.com',
    phone: '+16660001007',
    role: 'SELLER'
  });
  const { productA } = await harness.helpers.seedCatalogForSellers({
    sellerAId: seller._id,
    sellerBId: seller._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: buyer._id,
    items: [{ productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 }]
  });

  const buyerLogin = await harness.helpers.login({ email: buyer.email });
  const adminLogin = await harness.helpers.login({ email: admin.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'E2E Buyer 3',
        phone: '+16660001006',
        line1: '3 Test Lane',
        line2: '',
        city: 'Hyderabad',
        state: 'TS',
        pincode: '500001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'ONLINE'
    });
  const groupId = place.body.data.orderGroupId;
  const orderId = place.body.data.orderIds[0];

  const gateway = await harness.request
    .post('/api/payments/create-order')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({ orderId });
  await harness.request.post('/api/payments/webhook').send({
    event: 'payment.captured',
    externalOrderId: gateway.body.data.externalOrderId,
    externalPaymentId: `pay_${orderId}`
  });

  const cancel = await harness.request
    .post(`/api/orders/groups/${groupId}/cancel`)
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({});
  assert.equal(cancel.status, 200);

  const initiate = await harness.request
    .post(`/api/orders/groups/${groupId}/refund/initiate`)
    .set(harness.helpers.authHeader(adminLogin.accessToken))
    .send({});
  assert.equal(initiate.status, 200);

  const settle = await harness.request
    .post(`/api/orders/groups/${groupId}/refund/settle`)
    .set(harness.helpers.authHeader(adminLogin.accessToken))
    .send({ refundReferenceId: 'E2E-REF-001' });
  assert.equal(settle.status, 200);
  assert.ok((settle.body.data.children || []).every((row) => row.orderStatus === 'REFUNDED'));
});
