const SupportTicket = require('../models/SupportTicket');

const createTicket = (payload) => SupportTicket.create(payload);

module.exports = { createTicket };
