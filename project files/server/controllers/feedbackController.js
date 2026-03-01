const Feedback = require('../models/Feedback');
const Product = require('../models/Product');

const sanitizeText = (value, maxLength = 500) => String(value || '')
  .replace(/[^\w\s\-.,]/g, ' ')
  .trim()
  .slice(0, maxLength);

const submitFeedback = async (req, res, next) => {
  try {
    const productId = String(req.body?.productId || '').trim();
    const rating = Number(req.body?.rating);
    const comment = sanitizeText(req.body?.comment, 500);

    if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'productId and valid rating are required' });
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const feedback = await Feedback.create({
      userId: req.user._id,
      productId,
      rating,
      comment
    });

    return res.status(201).json(feedback);
  } catch (error) {
    return next(error);
  }
};

const getAllFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.find()
      .populate('userId', 'name email')
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(feedback);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  submitFeedback,
  getAllFeedback
};
