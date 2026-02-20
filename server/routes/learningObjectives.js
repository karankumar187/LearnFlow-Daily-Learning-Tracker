const express = require('express');
const { body } = require('express-validator');
const {
  createObjective,
  getObjectives,
  getObjective,
  updateObjective,
  deleteObjective,
  getCategories,
  getObjectiveWithProgress
} = require('../controllers/learningObjectiveController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const objectiveValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot be more than 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot be more than 1000 characters'),
  body('category')
    .optional()
    .trim(),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('estimatedTime')
    .optional()
    .isNumeric().withMessage('Estimated time must be a number'),
  body('color')
    .optional()
    .trim(),
  body('icon')
    .optional()
    .trim()
];

// Routes
router.post('/', protect, objectiveValidation, createObjective);
router.get('/', protect, getObjectives);
router.get('/categories/all', protect, getCategories);
router.get('/:id', protect, getObjective);
router.get('/:id/progress', protect, getObjectiveWithProgress);
router.put('/:id', protect, objectiveValidation, updateObjective);
router.delete('/:id', protect, deleteObjective);

module.exports = router;
