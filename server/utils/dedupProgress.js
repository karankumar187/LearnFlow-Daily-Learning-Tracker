const mongoose = require('mongoose');

/**
 * Removes duplicate DailyProgress documents so that the unique compound index
 * (user, learningObjective, date) can be applied without conflicts.
 *
 * Strategy: for each group of duplicates, keep the document that has the most
 * "valuable" status (completed > partial > pending > missed) and delete the rest.
 */
const dedupProgress = async () => {
    try {
        const DailyProgress = mongoose.model('DailyProgress');

        // Find all groups that have more than one doc for the same key
        const duplicates = await DailyProgress.aggregate([
            {
                $group: {
                    _id: { user: '$user', learningObjective: '$learningObjective', date: '$date' },
                    ids: { $push: '$_id' },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        if (duplicates.length === 0) {
            console.log('[dedupProgress] No duplicates found.');
            return;
        }

        console.log(`[dedupProgress] Found ${duplicates.length} duplicate groups — cleaning up…`);

        const STATUS_RANK = { completed: 4, partial: 3, pending: 2, missed: 1, skipped: 0 };
        let removed = 0;

        for (const group of duplicates) {
            const docs = await DailyProgress.find({ _id: { $in: group.ids } }).sort({ status: 1 });
            // Keep the one with the highest status rank (or most recently updated)
            docs.sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0));
            const [keep, ...rest] = docs;
            const idsToDelete = rest.map(d => d._id);
            await DailyProgress.deleteMany({ _id: { $in: idsToDelete } });
            removed += idsToDelete.length;
        }

        console.log(`[dedupProgress] Removed ${removed} duplicate DailyProgress records.`);
    } catch (err) {
        console.error('[dedupProgress] Error during dedup:', err.message);
    }
};

module.exports = dedupProgress;
