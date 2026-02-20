const express = require('express');
const { body } = require('express-validator');
const { submitFeedback } = require('../controllers/feedbackController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

router.post(
    '/',
    [
        body('type')
            .isIn(['bug', 'feedback'])
            .withMessage('Type must be either bug or feedback'),
        body('message')
            .trim()
            .notEmpty()
            .withMessage('Message is required')
            .isLength({ max: 1000 })
            .withMessage('Message cannot exceed 1000 characters'),
    ],
    submitFeedback
);

module.exports = router;
