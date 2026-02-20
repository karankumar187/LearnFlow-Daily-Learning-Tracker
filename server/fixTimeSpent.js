const mongoose = require('mongoose');
const DailyProgress = require('./models/DailyProgress');
const LearningObjective = require('./models/LearningObjective');
require('dotenv').config();

async function backfill() {
    await mongoose.connect(process.env.MONGODB_URI);

    const completedProgress = await DailyProgress.find({
        status: 'completed',
        $or: [{ timeSpent: { $exists: false } }, { timeSpent: 0 }]
    });

    let count = 0;
    for (let p of completedProgress) {
        const obj = await LearningObjective.findById(p.learningObjective);
        if (obj && obj.estimatedTime) {
            p.timeSpent = obj.estimatedTime;
            await p.save();
            count++;
        }
    }
    console.log(`Successfully backfilled ${count} completed tasks with accurate timeSpent!`);
    mongoose.disconnect();
}

backfill().catch(console.error);
