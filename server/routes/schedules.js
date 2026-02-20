const express = require('express');
const { body } = require('express-validator');
const {
  createSchedule,
  getSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  getDefaultSchedule,
  setDefaultSchedule,
  getTodaySchedule,
  updateDaySchedule,
  addItemToDay,
  removeItemFromDay
} = require('../controllers/scheduleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const scheduleValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Schedule name is required')
    .isLength({ max: 100 }).withMessage('Name cannot be more than 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description cannot be more than 500 characters'),
  body('weeklySchedule')
    .optional()
    .isArray().withMessage('Weekly schedule must be an array'),
  body('isDefault')
    .optional()
    .isBoolean().withMessage('isDefault must be a boolean')
];

const dayScheduleValidation = [
  body('items')
    .optional()
    .isArray().withMessage('Items must be an array')
];

const addItemValidation = [
  body('learningObjectiveId')
    .notEmpty().withMessage('Learning objective ID is required')
    .isMongoId().withMessage('Invalid learning objective ID')
];

// Routes
router.post('/', protect, scheduleValidation, createSchedule);
router.get('/', protect, getSchedules);
router.get('/default', protect, getDefaultSchedule);
router.get('/today', protect, getTodaySchedule);
router.get('/:id', protect, getSchedule);
router.put('/:id', protect, scheduleValidation, updateSchedule);
router.put('/:id/set-default', protect, setDefaultSchedule);
router.put('/:id/day/:day', protect, dayScheduleValidation, updateDaySchedule);
router.post('/:id/day/:day/item', protect, addItemValidation, addItemToDay);
router.delete('/:id/day/:day/item/:objectiveId', protect, removeItemFromDay);
router.delete('/:id', protect, deleteSchedule);

module.exports = router;
