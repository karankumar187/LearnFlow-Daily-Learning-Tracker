const moment = require('moment-timezone');
const DailyProgress = require('../models/DailyProgress');
const Schedule = require('../models/Schedule');

const TIMEZONE = 'Asia/Kolkata';

/**
 * Synchronizes a user's progress for the past given days up to today.
 * By default it looks back 7 days, but NEVER before the schedule was created.
 *
 * Logic:
 * 1. Checks what tasks were scheduled on each day.
 * 2. If a past day has a scheduled task but no DailyProgress record,
 *    it creates a "missed" record.
 * 3. If today has a scheduled task but no DailyProgress record,
 *    it creates a "pending" record.
 * 4. Ensures any pending tasks from past days are transitioned to "missed".
 */
const syncProgress = async (userId, daysToLookBack = 7, timezone = 'UTC') => {
    try {
        const schedule = await Schedule.findOne({
            user: userId,
            isDefault: true,
            isActive: true
        });

        if (!schedule || !schedule.weeklySchedule || schedule.weeklySchedule.length === 0) {
            return;
        }

        const today = moment.tz(timezone).startOf('day');

        const scheduleCreatedAt = moment.tz(schedule.createdAt, timezone).startOf('day');
        const earliestAllowedDate = scheduleCreatedAt;

        // 1. Mark past 'pending' items as 'missed', but only from scheduleCreatedAt onwards
        await DailyProgress.updateMany(
            {
                user: userId,
                date: {
                    $gte: earliestAllowedDate.toDate(),
                    $lt: today.toDate()
                },
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
            const targetDate = moment.tz(timezone).subtract(i, 'days').startOf('day');

            // Skip any date before the schedule was first created
            if (targetDate.isBefore(earliestAllowedDate)) {
                continue;
            }

            const targetDayName = weekDaysMap[targetDate.day()];
            const daySchedule = schedule.weeklySchedule.find(s => s.day === targetDayName);

            if (!daySchedule || !daySchedule.isActive || daySchedule.items.length === 0) {
                continue;
            }

            // Fetch all progress for this user on this day
            const existingProgress = await DailyProgress.find({
                user: userId,
                date: {
                    $gte: targetDate.clone().startOf('day').toDate(),
                    $lte: targetDate.clone().endOf('day').toDate()
                }
            });

            const existingObjectiveIds = existingProgress.map(p => p.learningObjective.toString());

            for (const item of daySchedule.items) {
                const objectiveId = item.learningObjective.toString();
                if (!existingObjectiveIds.includes(objectiveId)) {
                    const isToday = i === 0;
                    // Use upsert to prevent duplicate-insert from concurrent sync calls
                    await DailyProgress.updateOne(
                        {
                            user: userId,
                            learningObjective: item.learningObjective,
                            date: targetDate.clone().startOf('day').toDate()
                        },
                        {
                            $setOnInsert: {
                                user: userId,
                                learningObjective: item.learningObjective,
                                date: targetDate.clone().startOf('day').toDate(),
                                status: isToday ? 'pending' : 'missed',
                                timeSpent: 0
                            }
                        },
                        { upsert: true }
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error syncing progress:', error);
    }
};

module.exports = syncProgress;
