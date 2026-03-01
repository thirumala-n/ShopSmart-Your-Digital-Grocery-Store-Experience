const ImportJob = require('../models/ImportJob');

const createJob = (payload) => ImportJob.create(payload);

const findById = (id) => ImportJob.findById(id);

const findByIdLean = (id) => ImportJob.findById(id).lean();

const save = (doc) => doc.save();

module.exports = {
  createJob,
  findById,
  findByIdLean,
  save
};
