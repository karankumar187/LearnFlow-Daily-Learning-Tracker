const { validationResult } = require('express-validator');
const LearningObjective = require('../models/LearningObjective');
const DailyProgress = require('../models/DailyProgress');

// @desc    Create learning objective
// @route   POST /api/objectives
// @access  Private
exports.createObjective = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { title, description, category, priority, estimatedTime, color, icon } = req.body;

    const objective = await LearningObjective.create({
      user: req.user.id,
      title,
      description,
      category,
      priority,
      estimatedTime,
      color,
      icon
    });

    res.status(201).json({
      success: true,
      data: objective
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all learning objectives for user
// @route   GET /api/objectives
// @access  Private
exports.getObjectives = async (req, res, next) => {
  try {
    const { category, priority, isActive } = req.query;
    
    let query = { user: req.user.id };
    
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const objectives = await LearningObjective.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: objectives.length,
      data: objectives
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single learning objective
// @route   GET /api/objectives/:id
// @access  Private
exports.getObjective = async (req, res, next) => {
  try {
    const objective = await LearningObjective.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!objective) {
      return res.status(404).json({
        success: false,
        message: 'Learning objective not found'
      });
    }

    res.status(200).json({
      success: true,
      data: objective
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update learning objective
// @route   PUT /api/objectives/:id
// @access  Private
exports.updateObjective = async (req, res, next) => {
  try {
    let objective = await LearningObjective.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!objective) {
      return res.status(404).json({
        success: false,
        message: 'Learning objective not found'
      });
    }

    const { title, description, category, priority, estimatedTime, color, icon, isActive } = req.body;

    objective = await LearningObjective.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        category,
        priority,
        estimatedTime,
        color,
        icon,
        isActive,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: objective
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete learning objective
// @route   DELETE /api/objectives/:id
// @access  Private
exports.deleteObjective = async (req, res, next) => {
  try {
    const objective = await LearningObjective.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!objective) {
      return res.status(404).json({
        success: false,
        message: 'Learning objective not found'
      });
    }

    // Soft delete - mark as inactive
    objective.isActive = false;
    objective.updatedAt = Date.now();
    await objective.save();

    res.status(200).json({
      success: true,
      message: 'Learning objective deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get categories
// @route   GET /api/objectives/categories/all
// @access  Private
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await LearningObjective.distinct('category', {
      user: req.user.id,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get objective with daily progress
// @route   GET /api/objectives/:id/progress
// @access  Private
exports.getObjectiveWithProgress = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const objective = await LearningObjective.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!objective) {
      return res.status(404).json({
        success: false,
        message: 'Learning objective not found'
      });
    }

    let progressQuery = {
      user: req.user.id,
      learningObjective: req.params.id
    };

    if (startDate && endDate) {
      progressQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const progress = await DailyProgress.find(progressQuery)
      .sort({ date: -1 })
      .populate('learningObjective', 'title color icon');

    res.status(200).json({
      success: true,
      data: {
        objective,
        progress
      }
    });
  } catch (error) {
    next(error);
  }
};
