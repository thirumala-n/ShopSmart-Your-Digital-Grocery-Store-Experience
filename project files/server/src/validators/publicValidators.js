const { body, param } = require('express-validator');

const newsletter = [body('email').isEmail().normalizeEmail()];

const supportTicket = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('subject').isString().trim().isLength({ min: 3, max: 150 }),
  body('category').isString().trim().isLength({ min: 3, max: 60 }),
  body('message').isString().trim().isLength({ min: 10, max: 2000 })
];

const deliveryAvailability = [param('pincode').isString().trim().matches(/^\d{6}$/)];

module.exports = { newsletter, supportTicket, deliveryAvailability };
