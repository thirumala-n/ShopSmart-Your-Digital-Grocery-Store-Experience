const ProcessedWebhookEvent = require('../models/ProcessedWebhookEvent');

const createEvent = (payload, session = null) =>
  ProcessedWebhookEvent.create([payload], { session }).then((docs) => docs[0]);

const findByEventId = (eventId) => ProcessedWebhookEvent.findOne({ eventId }).lean();

module.exports = {
  createEvent,
  findByEventId
};
