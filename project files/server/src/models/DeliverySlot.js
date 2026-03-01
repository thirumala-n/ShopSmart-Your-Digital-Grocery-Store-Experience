const mongoose = require('mongoose');

const deliverySlotSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    timeWindow: { type: String, required: true },
    capacity: { type: Number, required: true, min: 0 },
    booked: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliverySlot', deliverySlotSchema);
