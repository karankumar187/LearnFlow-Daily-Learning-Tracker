const express = require('express');
const { body } = require('express-validator');
const {
  createOrUpdateProgress,
  getDailyProgress,
  getProgressRange,
  getObjectiveProgress,
  skipProgress,
  markMissedProgress,
  deleteProgress
} = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const progressValidation = [
  body('learningObjectiveId')
    .notEmpty().withMessage('Learning objective ID is required')
    .isMongoId().withMessage('Invalid learning objective ID'),
  body('date')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['pending', 'completed', 'missed', 'partial', 'skipped']).withMessage('Invalid status'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Remarks cannot be more than 1000 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes cannot be more than 2000 characters'),
  body('timeSpent')
    .optional()
    .isNumeric().withMessage('Time spent must be a number')
];

// Routes
router.post('/', protect, progressValidation, createOrUpdateProgress);
router.get('/daily', protect, getDailyProgress);
router.get('/range', protect, getProgressRange);
router.get('/objective/:objectiveId', protect, getObjectiveProgress);
router.post('/skip', protect, skipProgress);
router.post('/mark-missed', protect, markMissedProgress);
router.delete('/:id', protect, deleteProgress);

module.exports = router;
