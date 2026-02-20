const mongoose = require('mongoose');

const learningObjectiveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Please provide a category'],
    trim: true,
    default: 'General'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 60
  },
  color: {
    type: String,
    default: '#8b6d4b'
  },
  icon: {
    type: String,
    default: 'Book'
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
learningObjectiveSchema.index({ user: 1, isActive: 1 });
learningObjectiveSchema.index({ user: 1, category: 1 });

module.exports = mongoose.model('LearningObjective', learningObjectiveSchema);
