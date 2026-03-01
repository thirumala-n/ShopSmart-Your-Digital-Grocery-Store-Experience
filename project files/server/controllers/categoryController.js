const Category = require('../models/Category');

const sanitizeText = (value, maxLength = 120) => String(value || '')
  .replace(/[^\w\s\-.,]/g, ' ')
  .trim()
  .slice(0, maxLength);

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    return res.status(200).json(categories);
  } catch (error) {
    return next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const name = sanitizeText(req.body?.name, 80);
    const description = sanitizeText(req.body?.description, 300);

    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = await Category.create({ name, description });
    return res.status(201).json(category);
  } catch (error) {
    return next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    return res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  deleteCategory
};
