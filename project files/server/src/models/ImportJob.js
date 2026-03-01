const mongoose = require('mongoose');

const importJobSchema = new mongoose.Schema(
  {
    jobType: { type: String, enum: ['PRODUCT_CSV', 'STOCK_CSV'], required: true, index: true },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'], default: 'PENDING', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    successRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    failureReport: {
      type: [
        {
          rowNumber: { type: Number, required: true },
          reason: { type: String, required: true }
        }
      ],
      default: []
    },
    notificationSent: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' }
  },
  { timestamps: true }
);

importJobSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ImportJob', importJobSchema);
