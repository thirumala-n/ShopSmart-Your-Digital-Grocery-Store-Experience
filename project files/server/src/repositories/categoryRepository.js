const Category = require('../models/Category');

const listRootCategories = () =>
  Category.find({ level: 0, isActive: true }).sort({ displayOrder: 1, name: 1 }).lean();

const listByParent = (parentCategoryId) =>
  Category.find({ parentCategoryId, isActive: true }).sort({ displayOrder: 1, name: 1 }).lean();

const findBySlug = (slug) => Category.findOne({ slug, isActive: true }).lean();

module.exports = { listRootCategories, listByParent, findBySlug };
