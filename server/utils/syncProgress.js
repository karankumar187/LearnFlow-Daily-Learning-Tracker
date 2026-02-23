const moment = require('moment-timezone');
const DailyProgress = require('../models/DailyProgress');
const Schedule = require('../models/Schedule');

const TIMEZONE = 'Asia/Kolkata';

/**
 * Synchronizes a user's progress for the past given days up to today.
 * By default it looks back 7 days.
 * 
 * Logic:
 * 1. Checks what tasks were scheduled on each day.
 * 2. If a past day has a scheduled task but no corresponding DailyProgress record,
 *    it creates a "missed" record.
 * 3. If today has a scheduled task but no DailyProgress record, 
 *    it creates a "pending" record.
 * 4. Ensures any pending tasks from past days are transitioned to "missed".
 */
const syncProgress = async (userId, daysToLookBack = 7) => {
    try {
        const schedule = await Schedule.findOne({
            user: userId,
            isDefault: true,
            isActive: true
        });

        if (!schedule || !schedule.weeklySchedule || schedule.weeklySchedule.length === 0) {
            return;
        }

        const today = moment.tz(TIMEZONE).startOf('day');

        // 1. Mark past 'pending' items as 'missed' first
        await DailyProgress.updateMany(
            {
                user: userId,
                date: { $lt: today.toDate() },
                status: 'pending'
            },
            {
                status: 'missed',
                updatedAt: Date.now()
            }
        );

        const weekDaysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        // 2. Loop through recent days and backfill missing records
        for (let i = daysToLookBack; i >= 0; i--) {
            const targetDate = moment.tz(TIMEZONE).subtract(i, 'days').startOf('day');
            const targetDayName = weekDaysMap[targetDate.day()];

            const daySchedule = schedule.weeklySchedule.find(s => s.day === targetDayName);

            const items = (daySchedule && daySchedule.isActive && daySchedule.items) ? daySchedule.items : [];

            // Fetch all progress for this user on this day
            const existingProgress = await DailyProgress.find({
                user: userId,
                date: {
                    $gte: targetDate.clone().startOf('day').toDate(),
                    $lte: targetDate.clone().endOf('day').toDate()
                }
            });

            const scheduledObjectiveIds = items.map(i => i.learningObjective ? i.learningObjective.toString() : null).filter(Boolean);
            const existingObjectiveIds = existingProgress.map(p => p.learningObjective ? p.learningObjective.toString() : null).filter(Boolean);

            // 2a. Delete 'pending' or 'missed' records that are NO LONGER in the schedule for this day
            // Also cleans up any DailyProgress completely missing a learningObjective reference
            const orphanedProgressIds = existingProgress
                .filter(p => {
                    if (p.status !== 'pending' && p.status !== 'missed') return false;
                    if (!p.learningObjective) return true; // clean up dead references
                    return !scheduledObjectiveIds.includes(p.learningObjective.toString());
                })
                .map(p => p._id);

            if (orphanedProgressIds.length > 0) {
                await DailyProgress.deleteMany({ _id: { $in: orphanedProgressIds } });
            }

            const recordsToCreate = [];

            for (const item of items) {
                if (!item.learningObjective) continue;

                const objectiveId = item.learningObjective.toString();
                if (!existingObjectiveIds.includes(objectiveId)) {
                    // Task was scheduled but no record exists yet
                    const isToday = i === 0;

                    recordsToCreate.push({
                        user: userId,
                        learningObjective: item.learningObjective,
                        date: targetDate.clone().startOf('day').toDate(),
                        status: isToday ? 'pending' : 'missed',
                        timeSpent: 0
                    });
                }
            }

            if (recordsToCreate.length > 0) {
                await DailyProgress.insertMany(recordsToCreate);
            }
        }
    } catch (error) {
        console.error('Error syncing progress:', error);
    }
};

module.exports = syncProgress;
