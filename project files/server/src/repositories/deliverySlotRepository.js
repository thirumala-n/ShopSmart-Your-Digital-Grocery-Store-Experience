const DeliverySlot = require('../models/DeliverySlot');

const listAvailableSlots = (fromDate, toDate) =>
  DeliverySlot.find({
    date: { $gte: fromDate, $lte: toDate },
    isActive: true
  })
    .sort({ date: 1, timeWindow: 1 })
    .lean();

const reserveSlot = (slotId, session = null) =>
  DeliverySlot.findOneAndUpdate(
    { _id: slotId, isActive: true, $expr: { $lt: ['$booked', '$capacity'] } },
    { $inc: { booked: 1 } },
    { returnDocument: 'after', session }
  );

const releaseSlotByDateWindow = ({ date, timeWindow, session = null }) =>
  DeliverySlot.findOneAndUpdate(
    { date, timeWindow, booked: { $gt: 0 } },
    { $inc: { booked: -1 } },
    { returnDocument: 'after', session }
  );

module.exports = { listAvailableSlots, reserveSlot, releaseSlotByDateWindow };
