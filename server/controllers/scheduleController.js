const { validationResult } = require('express-validator');
const Schedule = require('../models/Schedule');
const LearningObjective = require('../models/LearningObjective');

// @desc    Create schedule
// @route   POST /api/schedules
// @access  Private
exports.createSchedule = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, description, weeklySchedule, isDefault } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
      await Schedule.updateMany(
        { user: req.user.id },
        { isDefault: false }
      );
    }

    const schedule = await Schedule.create({
      user: req.user.id,
      name,
      description,
      weeklySchedule,
      isDefault
    });

    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all schedules for user
// @route   GET /api/schedules
// @access  Private
exports.getSchedules = async (req, res, next) => {
  try {
    const schedules = await Schedule.find({
      user: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single schedule
// @route   GET /api/schedules/:id
// @access  Private
exports.getSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('weeklySchedule.items.learningObjective');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update schedule
// @route   PUT /api/schedules/:id
// @access  Private
exports.updateSchedule = async (req, res, next) => {
  try {
    let schedule = await Schedule.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    const { name, description, weeklySchedule, isDefault, isActive } = req.body;

    // If setting as default, unset other defaults
    if (isDefault && !schedule.isDefault) {
      await Schedule.updateMany(
        { user: req.user.id },
        { isDefault: false }
      );
    }

    schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        weeklySchedule,
        isDefault,
        isActive,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).populate('weeklySchedule.items.learningObjective');

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete schedule
// @route   DELETE /api/schedules/:id
// @access  Private
exports.deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Soft delete
    schedule.isActive = false;
    schedule.updatedAt = Date.now();
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get default schedule
// @route   GET /api/schedules/default
// @access  Private
exports.getDefaultSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      user: req.user.id,
      isDefault: true,
      isActive: true
    }).populate('weeklySchedule.items.learningObjective');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'No default schedule found'
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set schedule as default
// @route   PUT /api/schedules/:id/set-default
// @access  Private
exports.setDefaultSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Unset other defaults
    await Schedule.updateMany(
      { user: req.user.id },
      { isDefault: false }
    );

    // Set this as default
    schedule.isDefault = true;
    schedule.updatedAt = Date.now();
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Schedule set as default',
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's schedule
// @route   GET /api/schedules/today
// @access  Private
exports.getTodaySchedule = async (req, res, next) => {
  try {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];

    const schedule = await Schedule.findOne({
      user: req.user.id,
      isDefault: true,
      isActive: true
    }).populate('weeklySchedule.items.learningObjective');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'No default schedule found'
      });
    }

    const todaySchedule = schedule.weeklySchedule.find(s => s.day === today);

    res.status(200).json({
      success: true,
      data: {
        day: today,
        schedule: todaySchedule || { day: today, items: [], isActive: false }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update specific day in schedule
// @route   PUT /api/schedules/:id/day/:day
// @access  Private
exports.updateDaySchedule = async (req, res, next) => {
  try {
    const { items } = req.body;
    const { id, day } = req.params;

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day'
      });
    }

    let schedule = await Schedule.findOne({
      _id: id,
      user: req.user.id
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Find and update the specific day
    const dayIndex = schedule.weeklySchedule.findIndex(s => s.day === day.toLowerCase());
    
    if (dayIndex >= 0) {
      schedule.weeklySchedule[dayIndex].items = items || [];
    } else {
      schedule.weeklySchedule.push({
        day: day.toLowerCase(),
        items: items || [],
        isActive: true
      });
    }

    schedule.updatedAt = Date.now();
    await schedule.save();

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to day's schedule (simplified - no time required)
// @route   POST /api/schedules/:id/day/:day/item
// @access  Private
exports.addItemToDay = async (req, res, next) => {
  try {
    const { learningObjectiveId } = req.body;
    const { id, day } = req.params;

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day'
      });
    }

    // Verify objective exists and belongs to user
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

    let schedule = await Schedule.findOne({
      _id: id,
      user: req.user.id
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Find the day schedule
    const dayIndex = schedule.weeklySchedule.findIndex(s => s.day === day.toLowerCase());
    
    const newItem = {
      learningObjective: learningObjectiveId,
      startTime: null,
      endTime: null,
      duration: objective.estimatedTime || 60
    };

    if (dayIndex >= 0) {
      // Check if already exists
      const existingIndex = schedule.weeklySchedule[dayIndex].items.findIndex(
        item => item.learningObjective.toString() === learningObjectiveId
      );
      
      if (existingIndex >= 0) {
        return res.status(400).json({
          success: false,
          message: 'Objective already in schedule for this day'
        });
      }
      
      schedule.weeklySchedule[dayIndex].items.push(newItem);
    } else {
      schedule.weeklySchedule.push({
        day: day.toLowerCase(),
        items: [newItem],
        isActive: true
      });
    }

    schedule.updatedAt = Date.now();
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Item added to schedule',
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from day's schedule
// @route   DELETE /api/schedules/:id/day/:day/item/:objectiveId
// @access  Private
exports.removeItemFromDay = async (req, res, next) => {
  try {
    const { id, day, objectiveId } = req.params;

    let schedule = await Schedule.findOne({
      _id: id,
      user: req.user.id
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    const dayIndex = schedule.weeklySchedule.findIndex(s => s.day === day.toLowerCase());
    
    if (dayIndex >= 0) {
      schedule.weeklySchedule[dayIndex].items = schedule.weeklySchedule[dayIndex].items.filter(
        item => item.learningObjective.toString() !== objectiveId
      );
    }

    schedule.updatedAt = Date.now();
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from schedule',
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};
