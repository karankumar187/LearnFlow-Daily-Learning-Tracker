const Notification = require('../models/Notification');
const DailyProgress = require('../models/DailyProgress');
const moment = require('moment-timezone');

const TIMEZONE = 'UTC';

// @desc    Get all notifications for user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ user: req.user.id }).sort('-createdAt');

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
    try {
        let notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Ensure user owns notification
        if (notification.user.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this notification'
            });
        }

        notification.read = true;
        await notification.save();

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark ALL notifications as read for user
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, read: false },
            { read: true }
        );
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new notification (Can be used internally or explicitly by generic actions)
// @route   POST /api/notifications
// @access  Private
exports.createNotification = async (req, res, next) => {
    try {
        req.body.user = req.user.id;
        const notification = await Notification.create(req.body);

        res.status(201).json({
            success: true,
            data: notification
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Trigger a pending-tasks reminder for the current user right now
// @route   POST /api/notifications/trigger-reminder
// @access  Private
exports.triggerPendingReminder = async (req, res, next) => {
    try {
        const todayStart = moment.tz(TIMEZONE).startOf('day').toDate();
        const todayEnd = moment.tz(TIMEZONE).endOf('day').toDate();

        const pendingEntries = await DailyProgress.find({
            user: req.user.id,
            date: { $gte: todayStart, $lte: todayEnd },
            status: 'pending'
        }).populate('learningObjective', 'title');

        if (pendingEntries.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No pending tasks today — nothing to remind!'
            });
        }

        const taskCount = pendingEntries.length;
        const taskList = pendingEntries.slice(0, 3).map(e => e.learningObjective?.title || 'Unnamed task').join(', ');
        const extra = taskCount > 3 ? ` and ${taskCount - 3} more` : '';

        const hour = moment.tz(TIMEZONE).hour();
        const isNight = hour >= 20;

        const notification = await Notification.create({
            user: req.user.id,
            title: isNight ? 'Late Night Reminder' : 'Pending Tasks Reminder',
            message: `You have ${taskCount} pending task${taskCount > 1 ? 's' : ''} today: ${taskList}${extra}. Keep going!`,
            type: 'warning'
        });

        res.status(201).json({
            success: true,
            data: notification,
            pendingCount: taskCount
        });
    } catch (error) {
        next(error);
    }
};
