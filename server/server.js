const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const moment = require('moment-timezone');

// Security packages
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

// Load env variables in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Import DB connection
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const learningObjectiveRoutes = require('./routes/learningObjectives');
const progressRoutes = require('./routes/progress');
const scheduleRoutes = require('./routes/schedules');
const analyticsRoutes = require('./routes/analytics');
const aiAssistantRoutes = require('./routes/aiAssistant');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import models for cron jobs
const DailyProgress = require('./models/DailyProgress');
const Schedule = require('./models/Schedule');
const LearningObjective = require('./models/LearningObjective');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Set security HTTP headers
app.use(helmet());

// Sanitize data against NoSQL Query Injection
app.use(mongoSanitize());

// Sanitize data against XSS
app.use(xss());

// Prevent HTTP Param Pollution
app.use(hpp());

// Rate Limiting (100 reqs per 10 mins)
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again in 10 minutes'
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/objectives', learningObjectiveRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiAssistantRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata (IST)'
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Learning Management System API',
    version: '1.0.0'
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

/* =========================
   START SERVER PROPERLY
========================= */

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log('Database connected');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Handle unhandled rejections safely
    process.on('unhandledRejection', (err) => {
      console.error('UNHANDLED REJECTION! 💥 Shutting down...');
      console.error(err.name, err.message);

      server.close(() => {
        process.exit(1);
      });
    });

    /* =========================
       CRON JOBS
    ========================= */

    // Auto-mark missed progress (11:59 PM IST)
    cron.schedule('29 18 * * *', async () => {
      console.log('Running auto-mark missed progress cron job...');

      try {
        const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').startOf('day').toDate();
        const endOfYesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').endOf('day').toDate();

        const result = await DailyProgress.updateMany(
          {
            date: { $gte: yesterday, $lte: endOfYesterday },
            status: 'pending'
          },
          {
            status: 'missed',
            updatedAt: Date.now()
          }
        );

        console.log(`Auto-marked ${result.modifiedCount} entries as missed`);
      } catch (error) {
        console.error('Error in auto-mark cron job:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Create daily progress (12:01 AM IST)
    cron.schedule('31 18 * * *', async () => {
      console.log('Running daily progress creation cron job...');

      try {
        const today = moment.tz('Asia/Kolkata').startOf('day').toDate();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayDay = days[moment.tz('Asia/Kolkata').day()];

        const schedules = await Schedule.find({
          isDefault: true,
          isActive: true
        });

        let createdCount = 0;

        for (const schedule of schedules) {
          const todaySchedule = schedule.weeklySchedule.find(s => s.day === todayDay);

          if (todaySchedule && todaySchedule.items.length > 0) {
            for (const item of todaySchedule.items) {
              const existing = await DailyProgress.findOne({
                user: schedule.user,
                learningObjective: item.learningObjective,
                date: today
              });

              if (!existing) {
                await DailyProgress.create({
                  user: schedule.user,
                  learningObjective: item.learningObjective,
                  date: today,
                  status: 'pending',
                  timeSpent: 0
                });
                createdCount++;
              }
            }
          }
        }

        console.log(`Created ${createdCount} daily progress entries`);
      } catch (error) {
        console.error('Error in daily progress cron job:', error);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('Cron jobs scheduled successfully.');
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });