const moment = require('moment-timezone');
const DailyProgress = require('../models/DailyProgress');
const Schedule = require('../models/Schedule');

const TIMEZONE = 'Asia/Kolkata';

// In-memory lock to prevent race conditions when multiple API endpoints call syncProgress concurrently
const syncLocks = new Map();

/**
 * Synchronizes a user's progress for the past given days up to today.
 * Auto-cleans orphaned tasks and duplicate tasks to heal corrupted state.
 */
const syncProgress = async (userId, daysToLookBack = 7) => {
    const lockKey = userId.toString() + '_' + daysToLookBack;

    // If a sync is already running for this user, precisely share that promise
    if (syncLocks.has(lockKey)) {
        return syncLocks.get(lockKey);
    }

    const syncPromise = (async () => {
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

            // Calculate how many days left in the week (forward-fill)
            const endOfWeek = today.clone().endOf('week');
            const daysLookAhead = endOfWeek.diff(today, 'days');

            const scheduleCreatedAtDate = schedule.createdAt
                ? moment.tz(schedule.createdAt, TIMEZONE).startOf('day')
                : moment.tz(TIMEZONE).subtract(30, 'days').startOf('day');

            // --- AUTO-HEAL: Delete any 'missed' tasks erroneously generated before the schedule existed ---
            await DailyProgress.deleteMany({
                user: userId,
                status: 'missed',
                date: { $lt: scheduleCreatedAtDate.toDate() }
            });

            // 2. Loop through recent days and backfill/forward-fill missing records
            for (let i = daysToLookBack; i >= -daysLookAhead; i--) {
                const targetDate = moment.tz(TIMEZONE).subtract(i, 'days').startOf('day');

                // Do not create or expect tasks for days before the schedule even existed
                if (targetDate.isBefore(scheduleCreatedAtDate)) {
                    continue;
                }

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

                // --- AUTO-HEAL: DEDUPLICATE EXISTING CORRUPTED RECORDS ---
                // Because of the past race condition, users might have 4-5 copies of the same task progress
                const seenObj = new Set();
                const duplicateIds = [];
                const uniqueProgress = [];

                for (const p of existingProgress) {
                    const key = p.learningObjective ? p.learningObjective.toString() : 'null_ref';
                    if (key !== 'null_ref' && seenObj.has(key)) {
                        // It's a duplicate. We must delete it. Keep the first one we saw (presumably the oldest/most updated).
                        // Prefer keeping 'completed' ones over 'pending' duplicates if we can, but simple sequential works fine usually.
                        if (p.status === 'pending') {
                            duplicateIds.push(p._id);
                        } else {
                            // Edge case: this duplicate was completed, swap it so we keep the completed one
                            const prevIdx = uniqueProgress.findIndex(up => up.learningObjective?.toString() === key);
                            if (prevIdx !== -1 && uniqueProgress[prevIdx].status === 'pending') {
                                duplicateIds.push(uniqueProgress[prevIdx]._id); // mark older pending for deletion
                                uniqueProgress[prevIdx] = p; // keep completed
                            } else {
                                duplicateIds.push(p._id);
                            }
                        }
                    } else {
                        seenObj.add(key);
                        uniqueProgress.push(p);
                    }
                }

                if (duplicateIds.length > 0) {
                    await DailyProgress.deleteMany({ _id: { $in: duplicateIds } });
                }

                // We use the cleaned unique list for the rest of the sync
                const validExistingProgress = uniqueProgress;

                const scheduledObjectiveIds = items.map(i => i.learningObjective ? i.learningObjective.toString() : null).filter(Boolean);
                const existingObjectiveIds = validExistingProgress.map(p => p.learningObjective ? p.learningObjective.toString() : null).filter(Boolean);

                // 2a. Delete 'pending' or 'missed' records that are NO LONGER in the schedule for this day
                // Also cleans up any DailyProgress completely missing a learningObjective reference
                const orphanedProgressIds = validExistingProgress
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
                        recordsToCreate.push({
                            user: userId,
                            learningObjective: item.learningObjective,
                            date: targetDate.clone().startOf('day').toDate(),
                            status: i <= 0 ? 'pending' : 'missed',
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
        } finally {
            syncLocks.delete(lockKey);
        }
    })();

    syncLocks.set(lockKey, syncPromise);
    return syncPromise;
};

module.exports = syncProgress;
