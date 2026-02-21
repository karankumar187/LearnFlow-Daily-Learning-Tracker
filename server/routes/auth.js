const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRE } = require('../config/config');

const router = express.Router();

// Helper for OAuth Token Generation
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

// Validation middleware
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 50 }).withMessage('Name cannot be more than 50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  body('password')
    .notEmpty().withMessage('Password is required')
];

const passwordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, passwordValidation, changePassword);

// ==========================================
// OAuth Routes (Google, GitHub, Apple)
// ==========================================

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// --- Google ---
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?error=OAuthFailed`, session: false }),
  (req, res) => {
    const token = generateToken(req.user._id);
    res.redirect(`${CLIENT_URL}/oauth-callback?token=${token}`);
  }
);

// --- GitHub ---
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: `${CLIENT_URL}/login?error=OAuthFailed`, session: false }),
  (req, res) => {
    const token = generateToken(req.user._id);
    res.redirect(`${CLIENT_URL}/oauth-callback?token=${token}`);
  }
);

// --- Apple ---
router.get('/apple', passport.authenticate('apple'));

router.post(
  '/apple/callback',
  express.urlencoded({ extended: true }), // Apple sends a POST request URL-encoded
  passport.authenticate('apple', { failureRedirect: `${CLIENT_URL}/login?error=OAuthFailed`, session: false }),
  (req, res) => {
    const token = generateToken(req.user._id);
    res.redirect(`${CLIENT_URL}/oauth-callback?token=${token}`);
  }
);

module.exports = router;
