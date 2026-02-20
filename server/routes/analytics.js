const express = require('express');
const {
  getOverallAnalytics,
  getAnalyticsByObjective,
  getDailyAnalytics,
  getStreakInfo,
  getWeeklyChartData,
  getCategoryAnalytics
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Routes
router.get('/overall', protect, getOverallAnalytics);
router.get('/by-objective', protect, getAnalyticsByObjective);
router.get('/daily', protect, getDailyAnalytics);
router.get('/streak', protect, getStreakInfo);
router.get('/weekly-chart', protect, getWeeklyChartData);
router.get('/by-category', protect, getCategoryAnalytics);

module.exports = router;
