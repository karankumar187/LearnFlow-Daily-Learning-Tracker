const express = require('express');
const { body } = require('express-validator');
const {
  suggestSchedule,
  applySuggestion,
  getSuggestions,
  getSuggestion,
  updateSuggestion,
  deleteSuggestion
} = require('../controllers/aiAssistantController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const suggestValidation = [
  body('prompt')
    .trim()
    .notEmpty().withMessage('Prompt is required')
    .isLength({ max: 2000 }).withMessage('Prompt cannot be more than 2000 characters'),
  body('studyHoursPerDay')
    .optional()
    .isNumeric().withMessage('Study hours must be a number'),
  body('preferredTime')
    .optional()
    .isIn(['morning', 'afternoon', 'evening', 'night']).withMessage('Invalid preferred time')
];

const applyValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Name cannot be more than 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot be more than 500 characters')
];

// Routes
router.post('/suggest-schedule', protect, suggestValidation, suggestSchedule);
router.post('/apply-suggestion/:suggestionId', protect, applyValidation, applySuggestion);
router.get('/suggestions', protect, getSuggestions);
router.get('/suggestions/:id', protect, getSuggestion);
router.put('/suggestions/:id', protect, updateSuggestion);
router.delete('/suggestions/:id', protect, deleteSuggestion);

module.exports = router;
