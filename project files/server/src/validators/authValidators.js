const { body } = require('express-validator');

const register = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').isString().trim().isLength({ min: 10, max: 20 }),
  body('password')
    .isString()
    .isLength({ min: 8, max: 64 })
    .matches(/[a-z]/)
    .matches(/[0-9]/)
    .matches(/[^A-Za-z0-9]/)
];

const login = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 64 })
];

const refresh = [body('refreshToken').isString().trim().isLength({ min: 20 })];

const logout = [body('refreshToken').isString().trim().isLength({ min: 20 })];

module.exports = { register, login, refresh, logout };
