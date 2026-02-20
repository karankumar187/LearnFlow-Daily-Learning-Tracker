const mongoose = require('mongoose');

const scheduleItemSchema = new mongoose.Schema({
  objectiveTitle: {
    type: String,
    required: true
  },
  description: String,
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  startTime: {
    type: String,
    default: null
  },
  endTime: {
    type: String,
    default: null
  },
  duration: {
    type: Number,
    default: 60
  },
  category: String
});

const aiSuggestionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  prompt: {
    type: String,
    required: true,
    maxlength: [2000, 'Prompt cannot be more than 2000 characters']
  },
  suggestedSchedule: {
    type: [scheduleItemSchema],
    default: []
  },
  summary: {
    type: String,
    default: ''
  },
  isApplied: {
    type: Boolean,
    default: false
  },
  appliedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
aiSuggestionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AISuggestion', aiSuggestionSchema);
