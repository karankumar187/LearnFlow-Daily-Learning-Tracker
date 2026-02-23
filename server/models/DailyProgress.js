const mongoose = require('mongoose');

const dailyProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  learningObjective: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningObjective',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'missed', 'partial', 'skipped'],
    default: 'pending'
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [1000, 'Remarks cannot be more than 1000 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot be more than 2000 characters'],
    default: ''
  },
  completedAt: {
    type: Date,
    default: null
  },
  timeSpent: {
    type: Number, // in minutes
    default: 0
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

// Unique compound index: exactly one progress entry per objective per day per user
dailyProgressSchema.index({ user: 1, learningObjective: 1, date: 1 }, { unique: true });

// Index for date range queries
dailyProgressSchema.index({ user: 1, date: 1 });
dailyProgressSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('DailyProgress', dailyProgressSchema);
