const moment = require('moment-timezone');
const DailyProgress = require('../models/DailyProgress');
const LearningObjective = require('../models/LearningObjective');
const Schedule = require('../models/Schedule');
const syncProgress = require('../utils/syncProgress');

const getUserTimezone = (req) => req.user?.preferences?.timezone || 'UTC';

// @desc    Get overall analytics
// @route   GET /api/analytics/overall
// @access  Private
exports.getOverallAnalytics = async (req, res, next) => {
  try {
    const { period } = req.query; // 'daily', 'weekly', 'monthly', 'all'

    let dateFilter = {};
    const TIMEZONE = getUserTimezone(req);
    const now = moment.tz(TIMEZONE);

    if (period === 'daily') {
      dateFilter = {
        date: {
          $gte: now.clone().startOf('day').toDate(),
          $lte: now.clone().endOf('day').toDate()
        }
      };
    } else if (period === 'weekly') {
      dateFilter = {
        date: {
          $gte: now.clone().startOf('week').toDate(),
          $lte: now.clone().endOf('week').toDate()
        }
      };
    } else if (period === 'monthly') {
      dateFilter = {
        date: {
          $gte: now.clone().startOf('month').toDate(),
          $lte: now.clone().endOf('month').toDate()
        }
      };
    }

    // Sync before fetching analytics
    await syncProgress(req.user.id);

    // Get all progress for the period
    const query = { user: req.user.id };
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter.date;
    }

    const progress = await DailyProgress.find(query);

    // Calculate statistics
    const total = progress.length;
    const completed = progress.filter(p => p.status === 'completed').length;
    const missed = progress.filter(p => p.status === 'missed').length;
    const pending = progress.filter(p => p.status === 'pending').length;
    const partial = progress.filter(p => p.status === 'partial').length;

    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;
    const totalTimeSpent = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        period: period || 'all',
        total,
        completed,
        missed,
        pending,
        partial,
        completionRate: parseFloat(completionRate),
        totalTimeSpent,
        averageTimePerSession: total > 0 ? Math.round(totalTimeSpent / total) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get analytics by objective
// @route   GET /api/analytics/by-objective
// @access  Private
exports.getAnalyticsByObjective = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    const TIMEZONE = getUserTimezone(req);
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: moment.tz(startDate, TIMEZONE).startOf('day').toDate(),
          $lte: moment.tz(endDate, TIMEZONE).endOf('day').toDate()
        }
      };
    }

    // Sync before fetching
    await syncProgress(req.user.id);

    // Get all active objectives
    const objectives = await LearningObjective.find({
      user: req.user.id,
      isActive: true
    });

    // Get progress for each objective
    const objectiveAnalytics = await Promise.all(
      objectives.map(async (objective) => {
        const progress = await DailyProgress.find({
          user: req.user.id,
          learningObjective: objective._id,
          ...dateFilter
        });

        const total = progress.length;
        const completed = progress.filter(p => p.status === 'completed').length;
        const missed = progress.filter(p => p.status === 'missed').length;
        const pending = progress.filter(p => p.status === 'pending').length;
        const partial = progress.filter(p => p.status === 'partial').length;

        const completionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;
        const totalTimeSpent = progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0);

        return {
          objective: {
            id: objective._id,
            title: objective.title,
            category: objective.category,
            color: objective.color,
            icon: objective.icon
          },
          stats: {
            total,
            completed,
            missed,
            pending,
            partial,
            completionRate: parseFloat(completionRate),
            totalTimeSpent,
            averageTimePerSession: total > 0 ? Math.round(totalTimeSpent / total) : 0
          }
        };
      })
    );

    // Sort by completion rate (descending)
    objectiveAnalytics.sort((a, b) => b.stats.completionRate - a.stats.completionRate);

    res.status(200).json({
      success: true,
      count: objectiveAnalytics.length,
      data: objectiveAnalytics
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily analytics for calendar view
// @route   GET /api/analytics/daily
// @access  Private
exports.getDailyAnalytics = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    const TIMEZONE = getUserTimezone(req);
    const targetMonth = month ? parseInt(month) - 1 : moment.tz(TIMEZONE).month();
    const targetYear = year ? parseInt(year) : moment.tz(TIMEZONE).year();

    const startOfMonth = moment.tz({ year: targetYear, month: targetMonth }, TIMEZONE).startOf('month');
    const endOfMonth = moment.tz({ year: targetYear, month: targetMonth }, TIMEZONE).endOf('month');

    // Sync before fetching
    await syncProgress(req.user.id, 14); // slightly longer sync for calendar context

    const progress = await DailyProgress.find({
      user: req.user.id,
      date: {
        $gte: startOfMonth.toDate(),
        $lte: endOfMonth.toDate()
      }
    }).populate('learningObjective', 'title color icon');

    // Group by date
    const dailyData = {};

    // Initialize all days of the month
    for (let day = 1; day <= endOfMonth.date(); day++) {
      const dateKey = moment.tz({ year: targetYear, month: targetMonth, day }, TIMEZONE).format('YYYY-MM-DD');
      dailyData[dateKey] = {
        date: dateKey,
        total: 0,
        completed: 0,
        missed: 0,
        pending: 0,
        partial: 0,
        skipped: 0,
        entries: []
      };
    }

    // Populate with actual data
    progress.forEach(p => {
      const dateKey = moment.tz(p.date, TIMEZONE).format('YYYY-MM-DD');
      if (dailyData[dateKey]) {
        dailyData[dateKey].total++;
        dailyData[dateKey][p.status]++;
        dailyData[dateKey].entries.push({
          objectiveId: p.learningObjective._id,
          objectiveTitle: p.learningObjective.title,
          objectiveColor: p.learningObjective.color,
          objectiveIcon: p.learningObjective.icon,
          status: p.status,
          remarks: p.remarks,
          timeSpent: p.timeSpent,
          completedAt: p.completedAt
        });
      }
    });

    res.status(200).json({
      success: true,
      month: targetMonth + 1,
      year: targetYear,
      data: Object.values(dailyData)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get streak information
// @route   GET /api/analytics/streak
// @access  Private
exports.getStreakInfo = async (req, res, next) => {
  try {
    const TIMEZONE = getUserTimezone(req);
    // Sync before fetching
    await syncProgress(req.user.id, 14);

    // Get all completed progress ordered by date
    const progress = await DailyProgress.find({
      user: req.user.id,
      status: 'completed'
    }).sort({ date: -1 });

    if (progress.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 0,
          lastCompletedDate: null
        }
      });
    }

    // Get unique dates with completions
    const completedDates = [...new Set(progress.map(p =>
      moment.tz(p.date, TIMEZONE).format('YYYY-MM-DD')
    ))].sort().reverse();

    // Calculate current streak
    let currentStreak = 0;
    const today = moment.tz(TIMEZONE).format('YYYY-MM-DD');
    const yesterday = moment.tz(TIMEZONE).subtract(1, 'day').format('YYYY-MM-DD');

    // Check if streak is still active (completed today or yesterday)
    if (completedDates[0] === today || completedDates[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < completedDates.length; i++) {
        const prevDate = moment.tz(completedDates[i - 1], TIMEZONE);
        const currDate = moment.tz(completedDates[i], TIMEZONE);

        if (prevDate.diff(currDate, 'days') === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 1;
    let currentLongest = 1;

    const sortedDates = [...completedDates].sort();
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = moment.tz(sortedDates[i - 1], TIMEZONE);
      const currDate = moment.tz(sortedDates[i], TIMEZONE);

      if (currDate.diff(prevDate, 'days') === 1) {
        currentLongest++;
        longestStreak = Math.max(longestStreak, currentLongest);
      } else {
        currentLongest = 1;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        currentStreak,
        longestStreak,
        lastCompletedDate: completedDates[0],
        totalCompletedDays: completedDates.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly progress chart data
// @route   GET /api/analytics/weekly-chart
// @access  Private
exports.getWeeklyChartData = async (req, res, next) => {
  try {
    const TIMEZONE = getUserTimezone(req);
    const now = moment.tz(TIMEZONE);
    const startOfWeek = now.clone().startOf('week');
    const endOfWeek = now.clone().endOf('week');

    // Sync before fetching
    await syncProgress(req.user.id);

    const progress = await DailyProgress.find({
      user: req.user.id,
      date: {
        $gte: startOfWeek.toDate(),
        $lte: endOfWeek.toDate()
      }
    });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const chartData = days.map((day, index) => {
      const dayStart = startOfWeek.clone().add(index, 'days').startOf('day');
      const dayEnd = startOfWeek.clone().add(index, 'days').endOf('day');

      const dayProgress = progress.filter(p => {
        const pDate = moment.tz(p.date, TIMEZONE);
        return pDate.isBetween(dayStart, dayEnd, null, '[]');
      });

      return {
        day,
        completed: dayProgress.filter(p => p.status === 'completed').length,
        missed: dayProgress.filter(p => p.status === 'missed').length,
        pending: dayProgress.filter(p => p.status === 'pending').length,
        partial: dayProgress.filter(p => p.status === 'partial').length,
        total: dayProgress.length,
        timeSpent: parseFloat((dayProgress.reduce((sum, p) => sum + (p.timeSpent || 0), 0) / 60).toFixed(2)), // precise decimal hours for chart
        timeSpentMinutes: dayProgress.reduce((sum, p) => sum + (p.timeSpent || 0), 0) // raw minutes for tooltip formatting
      };
    });

    res.status(200).json({
      success: true,
      data: chartData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get category-wise analytics
// @route   GET /api/analytics/by-category
// @access  Private
exports.getCategoryAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const TIMEZONE = getUserTimezone(req);

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: moment.tz(startDate, TIMEZONE).startOf('day').toDate(),
          $lte: moment.tz(endDate, TIMEZONE).endOf('day').toDate()
        }
      };
    }

    // Sync before fetching
    await syncProgress(req.user.id);

    // Get all objectives with their categories
    const objectives = await LearningObjective.find({
      user: req.user.id,
      isActive: true
    });

    // Group by category
    const categoryMap = {};

    for (const objective of objectives) {
      const category = objective.category || 'Uncategorized';

      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          objectives: [],
          total: 0,
          completed: 0,
          missed: 0,
          pending: 0,
          partial: 0,
          totalTimeSpent: 0
        };
      }

      const progress = await DailyProgress.find({
        user: req.user.id,
        learningObjective: objective._id,
        ...dateFilter
      });

      const objStats = {
        objectiveId: objective._id,
        title: objective.title,
        total: progress.length,
        completed: progress.filter(p => p.status === 'completed').length,
        missed: progress.filter(p => p.status === 'missed').length,
        pending: progress.filter(p => p.status === 'pending').length,
        partial: progress.filter(p => p.status === 'partial').length,
        timeSpent: progress.reduce((sum, p) => sum + (p.timeSpent || 0), 0)
      };

      categoryMap[category].objectives.push(objStats);
      categoryMap[category].total += objStats.total;
      categoryMap[category].completed += objStats.completed;
      categoryMap[category].missed += objStats.missed;
      categoryMap[category].pending += objStats.pending;
      categoryMap[category].partial += objStats.partial;
      categoryMap[category].totalTimeSpent += objStats.timeSpent;
    }

    // Calculate completion rates
    const categoryAnalytics = Object.values(categoryMap).map(cat => ({
      ...cat,
      completionRate: cat.total > 0 ? parseFloat(((cat.completed / cat.total) * 100).toFixed(2)) : 0
    }));

    // Sort by completion rate
    categoryAnalytics.sort((a, b) => b.completionRate - a.completionRate);

    res.status(200).json({
      success: true,
      data: categoryAnalytics
    });
  } catch (error) {
    next(error);
  }
};
