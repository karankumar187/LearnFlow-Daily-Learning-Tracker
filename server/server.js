const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const moment = require('moment-timezone');
const passport = require('passport');
const session = require('express-session');

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
const feedbackRoutes = require('./routes/feedback');
const noteRoutes = require('./routes/notes');
const notificationRoutes = require('./routes/notifications');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import models for cron jobs
const DailyProgress = require('./models/DailyProgress');
const Schedule = require('./models/Schedule');
const Notification = require('./models/Notification');
const User = require('./models/User');
const LearningObjective = require('./models/LearningObjective');

const app = express();

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Guard: crash loudly if session secret is missing in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET && !process.env.JWT_SECRET) {
  console.error('FATAL: SESSION_SECRET or JWT_SECRET env var is required in production.');
  process.exit(1);
}

// Express Session
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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

// Global rate limit: 500 requests per 10 minutes
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again in 10 minutes.' }
});
app.use('/api', limiter);

// Stricter rate limit for auth endpoints: 10 attempts per 15 minutes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
  skipSuccessfulRequests: true // only count failed requests
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/objectives', learningObjectiveRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiAssistantRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    timezone: 'Dynamic (User Preference / UTC Fallback)'
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

    // Setup Passport strategies
    require('./config/passportConfig')();

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
       CRON JOBS (Timezone-Aware)
    ========================= */

    // Hourly task reminder: runs at minute block 0 of every hour
    cron.schedule('0 * * * *', async () => {
      console.log(`[Cron] Running timezone-aware hourly reminder check at ${moment().toISOString()}`);
      try {
        const users = await User.find({ 'preferences.notificationsEnabled': true });

        for (const user of users) {
          const tz = user.preferences?.timezone || 'UTC';
          const localHour = moment.tz(tz).hour();

          // 5 PM Local
          if (localHour === 17) {
            await sendIncompleteTaskReminderToUser(user, tz, 'evening');
          }
          // 10 PM Local
          if (localHour === 22) {
            await sendIncompleteTaskReminderToUser(user, tz, 'night');
          }
        }
      } catch (error) {
        console.error('Error in hourly reminder cron:', error);
      }
    });

    // Hourly Weekly Motivation: runs at minute block 0 of every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const users = await User.find({ 'preferences.notificationsEnabled': true });

        for (const user of users) {
          const tz = user.preferences?.timezone || 'UTC';
          const localMoment = moment.tz(tz);

          // Send weekly motivation at exactly Monday 9:00 AM local time
          if (localMoment.day() === 1 && localMoment.hour() === 9) {
            const weekAgo = localMoment.clone().subtract(7, 'days').startOf('day').toDate();
            const now = localMoment.clone().endOf('day').toDate();

            const completedLastWeek = await DailyProgress.countDocuments({
              user: user._id,
              status: 'completed',
              date: { $gte: weekAgo, $lte: now }
            });

            if (completedLastWeek > 0) {
              await Notification.create({
                user: user._id,
                title: 'Weekly Summary',
                message: `Last week you completed ${completedLastWeek} tasks. Let's make this week even better!`,
                type: 'info'
              });
            } else {
              await Notification.create({
                user: user._id,
                title: 'New Week, Fresh Start!',
                message: 'A new week begins! Set your learning goals and start building momentum.',
                type: 'info'
              });
            }
          }
        }
      } catch (error) {
        console.error('Error in hourly weekly motivation cron:', error);
      }
    });

    console.log('Cron jobs scheduled successfully.');
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

// Helper: Send incomplete task reminders to a specific user based on local timezone
async function sendIncompleteTaskReminderToUser(user, tz, timeOfDay) {
  const todayStart = moment.tz(tz).startOf('day').toDate();
  const todayEnd = moment.tz(tz).endOf('day').toDate();

  // Find all pending tasks today for this user
  const pendingEntries = await DailyProgress.find({
    user: user._id,
    date: { $gte: todayStart, $lte: todayEnd },
    status: 'pending'
  }).populate('learningObjective', 'title');

  if (pendingEntries.length === 0) return;

  const taskCount = pendingEntries.length;
  const taskList = pendingEntries.slice(0, 3).map(e => e.learningObjective?.title || 'Unnamed task').join(', ');
  const extra = taskCount > 3 ? ` and ${taskCount - 3} more` : '';

  const title = timeOfDay === 'evening'
    ? 'Evening Reminder'
    : 'Late Night Reminder';

  const message = timeOfDay === 'evening'
    ? `You still have ${taskCount} pending task${taskCount > 1 ? 's' : ''}: ${taskList}${extra}. Complete them before the day ends!`
    : `Don't forget! ${taskCount} task${taskCount > 1 ? 's are' : ' is'} still pending: ${taskList}${extra}. Wrap up before midnight!`;

  await Notification.create({
    user: user._id,
    title,
    message,
    type: 'warning'
  });
}