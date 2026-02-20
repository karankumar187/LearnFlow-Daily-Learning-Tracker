const mongoose = require('mongoose');

const scheduleItemSchema = new mongoose.Schema({
  learningObjective: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningObjective',
    required: true
  },
  startTime: {
    type: String, // Format: "HH:mm" (24-hour format) - optional now
    default: null
  },
  endTime: {
    type: String, // Format: "HH:mm" (24-hour format) - optional now
    default: null
  },
  duration: {
    type: Number, // in minutes - optional now
    default: 60
  }
});

const dailyScheduleSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  items: [scheduleItemSchema],
  isActive: {
    type: Boolean,
    default: true
  }
});

const scheduleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please provide a schedule name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  weeklySchedule: [dailyScheduleSchema],
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
scheduleSchema.index({ user: 1, isActive: 1 });
scheduleSchema.index({ user: 1, isDefault: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
