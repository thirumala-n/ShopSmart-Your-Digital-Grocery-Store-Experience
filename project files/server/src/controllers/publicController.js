const asyncHandler = require('../utils/asyncHandler');
const newsletterRepository = require('../repositories/newsletterRepository');
const supportTicketRepository = require('../repositories/supportTicketRepository');
const deliverySlotRepository = require('../repositories/deliverySlotRepository');
const AppError = require('../utils/AppError');
const { sendEmail } = require('../services/emailService');
const homeFeaturedRepository = require('../repositories/homeFeaturedRepository');

const subscribeNewsletter = asyncHandler(async (req, res) => {
  const result = await newsletterRepository.subscribe(req.body.email);
  const upserted = result?.lastErrorObject?.upserted;
  const alreadySubscribed = !upserted;
  res.status(alreadySubscribed ? 200 : 201).json({
    success: true,
    data: {
      email: req.body.email.toLowerCase(),
      message: alreadySubscribed ? 'Email already subscribed' : 'Subscription successful'
    }
  });
});

const createSupportTicket = asyncHandler(async (req, res) => {
  const ticket = await supportTicketRepository.createTicket({
    userId: req.auth?.userId || null,
    name: req.body.name,
    email: req.body.email,
    subject: req.body.subject,
    category: req.body.category,
    message: req.body.message
  });
  await sendEmail({
    to: req.body.email,
    subject: `Support ticket received: ${ticket._id}`,
    text: `Hi ${req.body.name}, we received your support request "${req.body.subject}". Ticket ID: ${ticket._id}. Our team will get back to you shortly.`
  });
  res.status(201).json({ success: true, data: ticket });
});

const listDeliverySlots = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const slots = await deliverySlotRepository.listAvailableSlots(start, end);
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({
    success: true,
    data: slots,
    items: slots,
    total: slots.length,
    page: 1,
    pageSize: slots.length,
    totalPages: 1
  });
});

const checkDeliveryAvailability = asyncHandler(async (req, res) => {
  const pincode = String(req.params.pincode || '').trim();
  if (!/^\d{6}$/.test(pincode)) {
    throw new AppError('Invalid pincode', 400, 'PINCODE_INVALID');
  }

  const configured = String(process.env.SERVICEABLE_PINCODES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const defaultServiceable = ['110001', '110002', '110003', '560001', '560002', '400001', '400002', '700001', '700002'];
  const serviceableSet = new Set(configured.length ? configured : defaultServiceable);
  const isServiceable = serviceableSet.has(pincode);

  if (!isServiceable) {
    return res.status(200).json({
      success: true,
      data: {
        pincode,
        serviceable: false,
        message: 'Not Deliverable to this pincode'
      }
    });
  }

  const eta = new Date();
  eta.setDate(eta.getDate() + 1);
  return res.status(200).json({
    success: true,
    data: {
      pincode,
      serviceable: true,
      expectedDeliveryDate: eta
    }
  });
});

const getHomeFeaturedConfig = asyncHandler(async (_req, res) => {
  const data = await homeFeaturedRepository.getConfig();
  res.status(200).json({ success: true, data });
});

module.exports = { subscribeNewsletter, createSupportTicket, listDeliverySlots, checkDeliveryAvailability, getHomeFeaturedConfig };
