const Feedback = require('../models/Feedback');
const { validationResult } = require('express-validator');

// @desc    Submit new bug report or feedback
// @route   POST /api/feedback
// @access  Private
exports.submitFeedback = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { type, message } = req.body;

        const feedback = await Feedback.create({
            user: req.user.id,
            type,
            message
        });

        res.status(201).json({
            success: true,
            data: feedback
        });
    } catch (error) {
        next(error);
    }
};
