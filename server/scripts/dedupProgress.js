/**
 * One-time deduplication script for DailyProgress records.
 * Run with: node server/scripts/dedupProgress.js
 *
 * For each (user, learningObjective, date) group with more than one record,
 * keeps the "best" record (priority: completed > partial > skipped > missed > pending,
 * then highest timeSpent) and deletes the rest.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const DailyProgress = require('../models/DailyProgress');

const STATUS_PRIORITY = { completed: 5, partial: 4, skipped: 3, missed: 2, pending: 1 };

const dedup = async () => {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all groups of (user, learningObjective, date) that have duplicates
    const duplicates = await DailyProgress.aggregate([
        {
            $group: {
                _id: {
                    user: '$user',
                    learningObjective: '$learningObjective',
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
                },
                count: { $sum: 1 },
                ids: { $push: '$_id' },
                statuses: { $push: '$status' },
                times: { $push: '$timeSpent' }
            }
        },
        { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`Found ${duplicates.length} duplicate groups`);

    let totalDeleted = 0;

    for (const group of duplicates) {
        const records = await DailyProgress.find({ _id: { $in: group.ids } });

        // Sort: best status first, then highest timeSpent
        records.sort((a, b) => {
            const aPriority = STATUS_PRIORITY[a.status] || 0;
            const bPriority = STATUS_PRIORITY[b.status] || 0;
            if (bPriority !== aPriority) return bPriority - aPriority;
            return (b.timeSpent || 0) - (a.timeSpent || 0);
        });

        // Keep the first (best), delete the rest
        const [keep, ...remove] = records;
        const removeIds = remove.map(r => r._id);

        await DailyProgress.deleteMany({ _id: { $in: removeIds } });
        totalDeleted += removeIds.length;

        console.log(`  Group ${group._id.date}: kept ${keep.status}, deleted ${removeIds.length} duplicate(s)`);
    }

    console.log(`\nDone. Deleted ${totalDeleted} duplicate records.`);
    await mongoose.disconnect();
};

dedup().catch(err => {
    console.error(err);
    process.exit(1);
});
