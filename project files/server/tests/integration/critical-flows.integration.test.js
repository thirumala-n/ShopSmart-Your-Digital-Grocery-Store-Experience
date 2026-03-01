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

test('registration enforces user role even when role is provided', async () => {
  const res = await harness.request.post('/api/auth/register').send({
    name: 'Role Escalation Attempt',
    email: 'role-enforce@example.com',
    phone: '+15550001001',
    password: 'Password!1',
    role: 'ADMIN'
  });

  assert.equal(res.status, 201);
  assert.equal(res.body?.data?.role, 'user');
});

test('login + refresh token rotation invalidates old refresh token', async () => {
  await harness.helpers.mkUser({
    name: 'Rotate User',
    email: 'rotate@example.com',
    phone: '+15550001002'
  });

  const login = await harness.request.post('/api/auth/login').send({
    email: 'rotate@example.com',
    password: 'Password!1'
  });
  assert.equal(login.status, 200);
  const refresh1 = login.body.data.refreshToken;

  const rotate = await harness.request.post('/api/auth/refresh').send({ refreshToken: refresh1 });
  assert.equal(rotate.status, 200);
  const refresh2 = rotate.body.data.refreshToken;
  assert.notEqual(refresh1, refresh2);

  const replay = await harness.request.post('/api/auth/refresh').send({ refreshToken: refresh1 });
  assert.equal(replay.status, 401);
  assert.equal(replay.body.code, 'TOKEN_REVOKED');
});

test('order placement supports multi-seller grouping', async () => {
  const user = await harness.helpers.mkUser({
    name: 'Buyer Multi',
    email: 'buyer.multi@example.com',
    phone: '+15550001003'
  });
  const sellerA = await harness.helpers.mkUser({
    name: 'Seller A',
    email: 'seller.a@example.com',
    phone: '+15550001004',
    role: 'SELLER'
  });
  const sellerB = await harness.helpers.mkUser({
    name: 'Seller B',
    email: 'seller.b@example.com',
    phone: '+15550001005',
    role: 'SELLER'
  });

  const { productA, productB } = await harness.helpers.seedCatalogForSellers({
    sellerAId: sellerA._id,
    sellerBId: sellerB._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: user._id,
    items: [
      { productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 },
      { productId: productB._id, variantId: productB.variants[0].variantId, quantity: 1 }
    ]
  });

  const { accessToken } = await harness.helpers.login({ email: user.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(accessToken))
    .send({
      shippingAddress: {
        fullName: 'Buyer Multi',
        phone: '+15550001003',
        line1: '123 Main Street',
        line2: '',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'ONLINE'
    });

  assert.equal(place.status, 201);
  assert.equal(place.body.data.totalOrders, 2);
  assert.ok(place.body.data.orderGroupId);
});

test('payment confirmation denies non-owner/non-admin actor', async () => {
  const owner = await harness.helpers.mkUser({
    name: 'Owner',
    email: 'owner.confirm@example.com',
    phone: '+15550001006'
  });
  const intruder = await harness.helpers.mkUser({
    name: 'Intruder',
    email: 'intruder.confirm@example.com',
    phone: '+15550001007'
  });
  const seller = await harness.helpers.mkUser({
    name: 'Seller C',
    email: 'seller.c@example.com',
    phone: '+15550001008',
    role: 'SELLER'
  });

  const { productA } = await harness.helpers.seedCatalogForSellers({
    sellerAId: seller._id,
    sellerBId: seller._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: owner._id,
    items: [{ productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 }]
  });

  const ownerLogin = await harness.helpers.login({ email: owner.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(ownerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'Owner',
        phone: '+15550001006',
        line1: '11 Street',
        line2: '',
        city: 'Pune',
        state: 'MH',
        pincode: '411001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'ONLINE'
    });
  const orderId = place.body.data.orderIds[0];

  const intruderLogin = await harness.helpers.login({ email: intruder.email });
  const confirm = await harness.request
    .post(`/api/orders/${orderId}/confirm-payment`)
    .set(harness.helpers.authHeader(intruderLogin.accessToken))
    .send({
      paymentGatewayOrderId: 'fake-order',
      paymentGatewayPaymentId: 'fake-payment'
    });

  assert.equal(confirm.status, 403);
  assert.equal(confirm.body.code, 'FORBIDDEN');
});

test('group cancellation works and cancellation updates all child orders', async () => {
  const buyer = await harness.helpers.mkUser({
    name: 'Group Cancel User',
    email: 'group.cancel@example.com',
    phone: '+15550001009'
  });
  const sellerA = await harness.helpers.mkUser({
    name: 'Seller GC A',
    email: 'seller.gc.a@example.com',
    phone: '+15550001010',
    role: 'SELLER'
  });
  const sellerB = await harness.helpers.mkUser({
    name: 'Seller GC B',
    email: 'seller.gc.b@example.com',
    phone: '+15550001011',
    role: 'SELLER'
  });
  const { productA, productB } = await harness.helpers.seedCatalogForSellers({
    sellerAId: sellerA._id,
    sellerBId: sellerB._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: buyer._id,
    items: [
      { productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 },
      { productId: productB._id, variantId: productB.variants[0].variantId, quantity: 1 }
    ]
  });
  const buyerLogin = await harness.helpers.login({ email: buyer.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'Group Cancel User',
        phone: '+15550001009',
        line1: '22 Street',
        line2: '',
        city: 'Nashik',
        state: 'MH',
        pincode: '422001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'ONLINE'
    });
  const groupId = place.body.data.orderGroupId;

  const cancel = await harness.request
    .post(`/api/orders/groups/${groupId}/cancel`)
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({});

  assert.equal(cancel.status, 200);
  assert.ok((cancel.body.data.children || []).every((row) => row.orderStatus === 'CANCELLED'));
});

test('refund lifecycle transitions CANCELLED paid orders to REFUNDED', async () => {
  const admin = await harness.helpers.mkUser({
    name: 'Admin Refund',
    email: 'admin.refund@example.com',
    phone: '+15550001012',
    role: 'ADMIN'
  });
  const buyer = await harness.helpers.mkUser({
    name: 'Buyer Refund',
    email: 'buyer.refund@example.com',
    phone: '+15550001013'
  });
  const sellerA = await harness.helpers.mkUser({
    name: 'Seller R A',
    email: 'seller.r.a@example.com',
    phone: '+15550001014',
    role: 'SELLER'
  });
  const sellerB = await harness.helpers.mkUser({
    name: 'Seller R B',
    email: 'seller.r.b@example.com',
    phone: '+15550001015',
    role: 'SELLER'
  });
  const { productA, productB } = await harness.helpers.seedCatalogForSellers({
    sellerAId: sellerA._id,
    sellerBId: sellerB._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: buyer._id,
    items: [
      { productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 },
      { productId: productB._id, variantId: productB.variants[0].variantId, quantity: 1 }
    ]
  });
  const buyerLogin = await harness.helpers.login({ email: buyer.email });
  const adminLogin = await harness.helpers.login({ email: admin.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'Buyer Refund',
        phone: '+15550001013',
        line1: '44 Street',
        line2: '',
        city: 'Delhi',
        state: 'DL',
        pincode: '110001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'ONLINE'
    });

  const orderIds = place.body.data.orderIds;
  const groupId = place.body.data.orderGroupId;

  for (const orderId of orderIds) {
    const createGateway = await harness.request
      .post('/api/payments/create-order')
      .set(harness.helpers.authHeader(buyerLogin.accessToken))
      .send({ orderId });
    assert.equal(createGateway.status, 200);
    const externalOrderId = createGateway.body.data.externalOrderId;
    const capture = await harness.request.post('/api/payments/webhook').send({
      event: 'payment.captured',
      externalOrderId,
      externalPaymentId: `pay_${orderId}`
    });
    assert.equal(capture.status, 200);
  }

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
  assert.ok((initiate.body.data.children || []).every((row) => row.orderStatus === 'REFUND_INITIATED'));

  const settle = await harness.request
    .post(`/api/orders/groups/${groupId}/refund/settle`)
    .set(harness.helpers.authHeader(adminLogin.accessToken))
    .send({ refundReferenceId: 'manual-ref-001' });
  assert.equal(settle.status, 200);
  assert.ok((settle.body.data.children || []).every((row) => row.orderStatus === 'REFUNDED'));
});

test('delivery OTP validation rejects invalid OTP and accepts valid OTP', async () => {
  const admin = await harness.helpers.mkUser({
    name: 'Admin OTP',
    email: 'admin.otp@example.com',
    phone: '+15550001016',
    role: 'ADMIN'
  });
  const buyer = await harness.helpers.mkUser({
    name: 'Buyer OTP',
    email: 'buyer.otp@example.com',
    phone: '+15550001017'
  });
  const seller = await harness.helpers.mkUser({
    name: 'Seller OTP',
    email: 'seller.otp@example.com',
    phone: '+15550001018',
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
  const adminLogin = await harness.helpers.login({ email: admin.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'Buyer OTP',
        phone: '+15550001017',
        line1: '77 Street',
        line2: '',
        city: 'Jaipur',
        state: 'RJ',
        pincode: '302001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'COD'
    });

  const orderId = place.body.data.orderIds[0];

  await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(sellerLogin.accessToken))
    .send({ nextStatus: 'PROCESSING' });
  await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(sellerLogin.accessToken))
    .send({ nextStatus: 'PACKED' });
  await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(sellerLogin.accessToken))
    .send({ nextStatus: 'SHIPPED', trackingId: 'TRACK-12345' });
  const ofd = await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(adminLogin.accessToken))
    .send({ nextStatus: 'OUT_FOR_DELIVERY' });
  assert.equal(ofd.status, 200);

  const invalidOtp = await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(adminLogin.accessToken))
    .send({ nextStatus: 'DELIVERED', deliveryOtp: '000000' });
  assert.equal(invalidOtp.status, 400);
  assert.equal(invalidOtp.body.code, 'DELIVERY_OTP_INVALID');

  const otp = harness.helpers.readLastOtp();
  const validOtp = await harness.request
    .patch(`/api/orders/${orderId}/status`)
    .set(harness.helpers.authHeader(adminLogin.accessToken))
    .send({ nextStatus: 'DELIVERED', deliveryOtp: otp });
  assert.equal(validOtp.status, 200);
  assert.equal(validOtp.body.data.orderStatus, 'DELIVERED');
});

test('seller order detail endpoint enforces seller scoping', async () => {
  const buyer = await harness.helpers.mkUser({
    name: 'Scope Buyer',
    email: 'scope.buyer@example.com',
    phone: '+15550001019'
  });
  const seller1 = await harness.helpers.mkUser({
    name: 'Scope Seller 1',
    email: 'scope.seller1@example.com',
    phone: '+15550001020',
    role: 'SELLER'
  });
  const seller2 = await harness.helpers.mkUser({
    name: 'Scope Seller 2',
    email: 'scope.seller2@example.com',
    phone: '+15550001021',
    role: 'SELLER'
  });
  const { productA } = await harness.helpers.seedCatalogForSellers({
    sellerAId: seller1._id,
    sellerBId: seller1._id
  });
  const slot = await harness.helpers.seedDeliverySlot();
  await harness.helpers.putCart({
    userId: buyer._id,
    items: [{ productId: productA._id, variantId: productA.variants[0].variantId, quantity: 1 }]
  });

  const buyerLogin = await harness.helpers.login({ email: buyer.email });
  const seller2Login = await harness.helpers.login({ email: seller2.email });
  const place = await harness.request
    .post('/api/orders')
    .set(harness.helpers.authHeader(buyerLogin.accessToken))
    .send({
      shippingAddress: {
        fullName: 'Scope Buyer',
        phone: '+15550001019',
        line1: '88 Street',
        line2: '',
        city: 'Lucknow',
        state: 'UP',
        pincode: '226001',
        label: 'Home'
      },
      deliverySlotId: String(slot._id),
      paymentMethod: 'COD'
    });

  const targetOrderId = place.body.data.orderIds[0];
  const forbidden = await harness.request
    .get(`/api/seller/orders/${targetOrderId}`)
    .set(harness.helpers.authHeader(seller2Login.accessToken));

  assert.equal(forbidden.status, 404);
  assert.equal(forbidden.body.code, 'ORDER_NOT_FOUND');
});
