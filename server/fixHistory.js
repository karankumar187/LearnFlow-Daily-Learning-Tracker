const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Schedule = require('./models/Schedule');
const DailyProgress = require('./models/DailyProgress');
const moment = require('moment-timezone');

dotenv.config({ path: './.env' });

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  const schedules = await Schedule.find({ isDefault: true });
  for (const schedule of schedules) {
    const userId = schedule.user;
    const createdAt = moment(schedule.createdAt).startOf('day').toDate();
    
    // Delete any 'missed' or 'pending' tasks that exist BEFORE the schedule was created
    const res = await DailyProgress.deleteMany({
      user: userId,
      status: { $in: ['missed', 'pending'] },
      date: { $lt: createdAt }
    });
    
    console.log(`User ${userId}: deleted ${res.deletedCount} corrupted historical records.`);
  }
  
  process.exit(0);
}
fix();
