const { validationResult } = require('express-validator');
const moment = require('moment-timezone');
const DailyProgress = require('../models/DailyProgress');
const LearningObjective = require('../models/LearningObjective');
const Schedule = require('../models/Schedule');
const Notification = require('../models/Notification');
const syncProgress = require('../utils/syncProgress');

const TIMEZONE = 'UTC';

// @desc    Create or update daily progress
// @route   POST /api/progress
// @access  Private
exports.createOrUpdateProgress = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { learningObjectiveId, date, status, remarks, notes, timeSpent } = req.body;
    console.log(`[createOrUpdate] Request for obj=${learningObjectiveId}, date=${date}, status=${status}`);

    // Verify the objective belongs to user
    const objective = await LearningObjective.findOne({
      _id: learningObjectiveId,
      user: req.user.id
    });

    if (!objective) {
      return res.status(404).json({
        success: false,
        message: 'Learning objective not found'
      });
    }

    const progressDateStart = moment.tz(date || new Date(), TIMEZONE).startOf('day').toDate();
    const progressDateEnd = moment.tz(date || new Date(), TIMEZONE).endOf('day').toDate();

    let progress = await DailyProgress.findOne({
      user: req.user.id,
      learningObjective: learningObjectiveId,
      date: {
        $gte: progressDateStart,
        $lte: progressDateEnd
      }
    });
    console.log(`[createOrUpdate] Found existing progress? ${!!progress} (ID: ${progress?._id})`);

    const updateData = {
      status,
      updatedAt: Date.now()
    };

    if (remarks !== undefined) {
      updateData.remarks = remarks;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (timeSpent !== undefined) {
      updateData.timeSpent = timeSpent;
    }

    if (status === 'completed') {
      updateData.completedAt = moment.tz(TIMEZONE).toDate();
      // Auto-fill timeSpent using objective's estimated time if not explicitly provided
      if (updateData.timeSpent === undefined) {
        // Only override if progress doesn't already have timeSpent recorded
        if (!progress || !progress.timeSpent) {
          updateData.timeSpent = objective.estimatedTime || 0;
        }
      }
    } else {
      updateData.completedAt = null;
    }

    if (progress) {
      // Update existing progress
      progress = await DailyProgress.findByIdAndUpdate(
        progress._id,
        updateData,
        { new: true, runValidators: true }
      ).populate('learningObjective', 'title color icon category');
    } else {
      // Create new progress
      progress = await DailyProgress.create({
        user: req.user.id,
        learningObjective: learningObjectiveId,
        date: progressDateStart,
        ...updateData
      });

      progress = await DailyProgress.findById(progress._id)
        .populate('learningObjective', 'title color icon category');
    }

    console.log(`[createOrUpdate] Returning saved status: ${progress.status}`);

    // --- Notification triggers for completed tasks ---
    if (status === 'completed') {
      try {
        const objTitle = objective.title || 'a task';

        // 1) Task completed notification
        await Notification.create({
          user: req.user.id,
          title: 'Task Completed!',
          message: `Great work! You completed "${objTitle}".`,
          type: 'success'
        });

        // 2) Check if ALL of today's tasks are now complete
        const todayStart = moment.tz(TIMEZONE).startOf('day').toDate();
        const todayEnd = moment.tz(TIMEZONE).endOf('day').toDate();
        const todayEntries = await DailyProgress.find({
          user: req.user.id,
          date: { $gte: todayStart, $lte: todayEnd }
        });

        if (todayEntries.length > 0) {
          const allDone = todayEntries.every(e => e.status === 'completed' || e.status === 'skipped');
          if (allDone) {
            await Notification.create({
              user: req.user.id,
              title: 'All Tasks Done!',
              message: `You have completed all ${todayEntries.length} tasks for today. Amazing consistency!`,
              type: 'success'
            });
          }
        }

        // 3) Streak milestone check
        const consecutiveDays = await calculateStreak(req.user.id);
        const milestones = [3, 5, 7, 14, 21, 30, 50, 100];
        if (milestones.includes(consecutiveDays)) {
          await Notification.create({
            user: req.user.id,
            title: `${consecutiveDays}-Day Streak!`,
            message: `Incredible! You have maintained a ${consecutiveDays}-day learning streak. Keep it up!`,
            type: 'success'
          });
        }
      } catch (notifErr) {
        console.error('[Notification] Error creating completion notification:', notifErr);
      }
    }

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error(`[createOrUpdate] Error:`, error);
    next(error);
  }
};

// Helper: calculate consecutive days with at least 1 completed task
async function calculateStreak(userId) {
  let streak = 0;
  let checkDate = moment.tz(TIMEZONE).startOf('day');

  while (true) {
    const dayStart = checkDate.toDate();
    const dayEnd = moment(checkDate).endOf('day').toDate();

    const completed = await DailyProgress.findOne({
      user: userId,
      date: { $gte: dayStart, $lte: dayEnd },
      status: 'completed'
    });

    if (completed) {
      streak++;
      checkDate.subtract(1, 'day');
    } else {
      break;
    }
  }

  return streak;
}

// @desc    Get daily progress for a specific date
// @route   GET /api/progress/daily
// @access  Private
exports.getDailyProgress = async (req, res, next) => {
  try {
    const { date } = req.query;

    // Sync before fetching
    await syncProgress(req.user.id);

    const queryDateStart = date
      ? moment.tz(date, TIMEZONE).startOf('day').toDate()
      : moment.tz(TIMEZONE).startOf('day').toDate();

    const queryDateEnd = date
      ? moment.tz(date, TIMEZONE).endOf('day').toDate()
      : moment.tz(TIMEZONE).endOf('day').toDate();

    const progress = await DailyProgress.find({
      user: req.user.id,
      date: {
        $gte: queryDateStart,
        $lte: queryDateEnd
      }
    }).populate('learningObjective', 'title color icon category estimatedTime');

    res.status(200).json({
      success: true,
      date: queryDateStart,
      data: progress
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get progress for date range
// @route   GET /api/progress/range
// @access  Private
exports.getProgressRange = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide startDate and endDate'
      });
    }

    // Sync before fetching
    await syncProgress(req.user.id);

    const start = moment.tz(startDate, TIMEZONE).startOf('day').toDate();
    const end = moment.tz(endDate, TIMEZONE).endOf('day').toDate();

    const progress = await DailyProgress.find({
      user: req.user.id,
      date: { $gte: start, $lte: end }
    })
      .populate('learningObjective', 'title color icon category')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get progress for specific objective
// @route   GET /api/progress/objective/:objectiveId
// @access  Private
exports.getObjectiveProgress = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Sync before fetching
    await syncProgress(req.user.id);

    let query = {
      user: req.user.id,
      learningObjective: req.params.objectiveId
    };

    if (startDate && endDate) {
      query.date = {
        $gte: moment.tz(startDate, TIMEZONE).startOf('day').toDate(),
        $lte: moment.tz(endDate, TIMEZONE).endOf('day').toDate()
      };
    }

    const progress = await DailyProgress.find(query)
      .populate('learningObjective', 'title color icon category')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark progress as skipped
// @route   POST /api/progress/skip
// @access  Private
exports.skipProgress = async (req, res, next) => {
  try {
    const { learningObjectiveId, date, remarks } = req.body;

    const progressDate = moment.tz(date || new Date(), TIMEZONE).startOf('day').toDate();

    let progress = await DailyProgress.findOne({
      user: req.user.id,
      learningObjective: learningObjectiveId,
      date: progressDate
    });

    const updateData = {
      status: 'skipped',
      remarks: remarks || 'Skipped by user',
      completedAt: null,
      updatedAt: Date.now()
    };

    if (progress) {
      progress = await DailyProgress.findByIdAndUpdate(
        progress._id,
        updateData,
        { new: true, runValidators: true }
      ).populate('learningObjective', 'title color icon category');
    } else {
      progress = await DailyProgress.create({
        user: req.user.id,
        learningObjective: learningObjectiveId,
        date: progressDate,
        ...updateData
      });

      progress = await DailyProgress.findById(progress._id)
        .populate('learningObjective', 'title color icon category');
    }

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark progress as missed (for cron job)
// @route   POST /api/progress/mark-missed
// @access  Private (Internal)
exports.markMissedProgress = async (req, res, next) => {
  try {
    const yesterday = moment.tz(TIMEZONE).subtract(1, 'day').startOf('day').toDate();
    const endOfYesterday = moment.tz(TIMEZONE).subtract(1, 'day').endOf('day').toDate();

    // Find all pending progress from yesterday and mark as missed
    const result = await DailyProgress.updateMany(
      {
        user: req.user.id,
        date: { $gte: yesterday, $lte: endOfYesterday },
        status: 'pending'
      },
      {
        status: 'missed',
        updatedAt: Date.now()
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} progress entries marked as missed`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete progress entry
// @route   DELETE /api/progress/:id
// @access  Private
exports.deleteProgress = async (req, res, next) => {
  try {
    const progress = await DailyProgress.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress entry not found'
      });
    }

    await DailyProgress.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Progress entry deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
