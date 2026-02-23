import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, progressAPI, objectivesAPI, authAPI } from '../services/api';
import { toast } from 'sonner';
import {
  Target,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Calendar,
  Sparkles,
  ArrowRight,
  Flame,
  BookOpen,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Globe
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

const COMMON_TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'IST — India (UTC+5:30)', value: 'Asia/Kolkata' },
  { label: 'EST — New York (UTC-5)', value: 'America/New_York' },
  { label: 'CST — Chicago (UTC-6)', value: 'America/Chicago' },
  { label: 'MST — Denver (UTC-7)', value: 'America/Denver' },
  { label: 'PST — Los Angeles (UTC-8)', value: 'America/Los_Angeles' },
  { label: 'GMT — London (UTC+0)', value: 'Europe/London' },
  { label: 'CET — Paris/Berlin (UTC+1)', value: 'Europe/Paris' },
  { label: 'EET — Athens (UTC+2)', value: 'Europe/Athens' },
  { label: 'MSK — Moscow (UTC+3)', value: 'Europe/Moscow' },
  { label: 'GST — Dubai (UTC+4)', value: 'Asia/Dubai' },
  { label: 'PKT — Pakistan (UTC+5)', value: 'Asia/Karachi' },
  { label: 'BST — Bangladesh (UTC+6)', value: 'Asia/Dhaka' },
  { label: 'ICT — Bangkok (UTC+7)', value: 'Asia/Bangkok' },
  { label: 'CST — China (UTC+8)', value: 'Asia/Shanghai' },
  { label: 'JST — Tokyo (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'AEST — Sydney (UTC+10)', value: 'Australia/Sydney' },
  { label: 'NZST — Auckland (UTC+12)', value: 'Pacific/Auckland' },
];

const getTodayInTZ = (tz = 'UTC') => {
  try {
    const s = new Date().toLocaleString('en-US', { timeZone: tz });
    return new Date(s);
  } catch {
    return new Date();
  }
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    missed: 0,
    pending: 0,
    completionRate: 0
  });
  const [streak, setStreak] = useState({
    currentStreak: 0,
    longestStreak: 0
  });
  const [todayProgress, setTodayProgress] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  // Timezone: load from localStorage (synced with backend on save)
  const [timezone, setTimezone] = useState(() => localStorage.getItem('avanza:timezone') || 'UTC');
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => getTodayInTZ(localStorage.getItem('avanza:timezone') || 'UTC'));
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [dailyAnalytics, setDailyAnalytics] = useState({});

  const welcomeRef = useRef(null);

  useGSAP(() => {
    if (!loading && stats) {
      gsap.from('.stagger-item', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'all'
      });
    }
  }, [loading, stats]);

  useEffect(() => {
    fetchDashboardData();

    // Auto-detect browser timezone if none saved yet
    const saved = localStorage.getItem('avanza:timezone');
    if (!saved) {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      handleTimezoneChange(detected);
    }
  }, []);

  useEffect(() => {
    fetchCalendarAnalytics(calendarDate);
  }, [calendarDate]);

  useEffect(() => {
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const lastPlayed = localStorage.getItem('learnflow:lastWelcomeAnimDate');
    if (lastPlayed === todayKey || !welcomeRef.current) return;

    localStorage.setItem('learnflow:lastWelcomeAnimDate', todayKey);

    const elements = welcomeRef.current.querySelectorAll('[data-welcome-anim]');
    if (!elements.length) return;

    gsap.fromTo(
      elements,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
      }
    );
  }, []);

  const handleTimezoneChange = async (tz) => {
    setTimezone(tz);
    setCurrentDate(getTodayInTZ(tz));
    setShowTzPicker(false);
    localStorage.setItem('avanza:timezone', tz);
    try {
      await authAPI.updateProfile({ preferences: { timezone: tz } });
      toast.success(`Timezone set to ${tz}`);
    } catch {
      toast.error('Could not save timezone to server (local preference applied)');
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [overallRes, streakRes, dailyRes, objectivesRes, weeklyRes] = await Promise.all([
        analyticsAPI.getOverall('daily'),
        analyticsAPI.getStreak(),
        progressAPI.getDaily(),
        objectivesAPI.getAll({ isActive: true }),
        analyticsAPI.getWeeklyChart()
      ]);

      setStats(overallRes.data.data);
      setStreak(streakRes.data.data);
      setTodayProgress(dailyRes.data.data || []);
      setObjectives(objectivesRes.data.data || []);
      setWeeklyData(weeklyRes.data.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarAnalytics = async (date) => {
    try {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const res = await analyticsAPI.getDaily(month, year);
      const map = {};
      (res.data.data || []).forEach((day) => {
        map[day.date] = day;
      });
      setDailyAnalytics(map);
    } catch (error) {
      console.error('Error fetching calendar analytics:', error);
    }
  };

  // Calendar functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      days.push({
        day,
        currentMonth: false,
        date: new Date(year, month - 1, day),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        currentMonth: true,
        date: new Date(year, month, i),
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        currentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }

    return days;
  };

  const isToday = (dayItem) => {
    if (!dayItem?.date) return false;
    const today = getTodayInTZ(timezone);
    return dayItem.date.toDateString() === today.toDateString();
  };

  const getDayStatus = (dateObj) => {
    // Build date key in the same timezone as analytics (Asia/Kolkata)
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const key = istFormatter.format(dateObj); // YYYY-MM-DD
    const data = dailyAnalytics[key];
    if (!data || data.total === 0) return null;

    const { completed, missed, pending, partial, total } = data;

    // All completed
    if (completed === total && missed === 0 && pending === 0 && partial === 0) {
      return 'success';
    }

    // All missed
    if (missed === total) {
      return 'danger';
    }

    // Partial (some completed but also some missed or partial)
    if (partial > 0 || (completed > 0 && (missed > 0 || pending > 0))) {
      return 'warning';
    }

    return null;
  };

  const prevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'missed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'skipped':
        return <Clock className="w-5 h-5 text-green-700" />;
      default:
        return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'missed':
        return 'bg-red-100 text-red-700';
      case 'skipped':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  const pieData = [
    { name: 'Completed', value: stats.completed, color: '#10b981' },
    { name: 'Missed', value: stats.missed, color: '#ef4444' },
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
  ].filter(item => item.value > 0);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn" ref={welcomeRef}>
      {/* Welcome Section with Date */}
      <div className="glass-card rounded-2xl p-6 bg-gray-100 ">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4" data-welcome-anim>
          <div data-welcome-anim>
            <div className="flex items-center gap-2 text-green-800 dark:text-green-400 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">{formatDate(currentDate)}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Welcome back!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Here's your learning progress for today
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Timezone picker */}
            <div className="relative">
              <button
                onClick={() => setShowTzPicker(p => !p)}
                title="Change timezone"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:border-green-600 transition-colors"
              >
                <Globe className="w-4 h-4 text-green-700" />
                <span className="max-w-[120px] truncate">{COMMON_TIMEZONES.find(t => t.value === timezone)?.label.split(' —')[0] || timezone}</span>
              </button>
              {showTzPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl w-72 max-h-72 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-gray-500 px-2 py-1">Select your timezone</p>
                  </div>
                  {COMMON_TIMEZONES.map(tz => (
                    <button
                      key={tz.value}
                      onClick={() => handleTimezoneChange(tz.value)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-green-50 dark:hover:bg-slate-800 ${timezone === tz.value
                        ? 'text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-slate-800'
                        : 'text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      {tz.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link
              to="/ai-assistant"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-800 text-white font-medium transition-all"
            >
              <Sparkles className="w-5 h-5" />
              Get AI Schedule
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Stats & Charts */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stagger-item stat-card">
              <div className="stat-icon blue">
                <Target className="w-6 h-6" />
              </div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Tasks</div>
            </div>

            <div className="stagger-item stat-card">
              <div className="stat-icon green">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div className="stat-value" style={{ color: '#1B4332' }}>{stats.completed}</div>
              <div className="stat-label">Completed</div>
            </div>

            <div className="stagger-item stat-card">
              <div className="stat-icon sage">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="stat-value" style={{ color: '#2D6A4F' }}>{stats.completionRate}%</div>
              <div className="stat-label">Completion</div>
            </div>

            <div className="stagger-item stat-card">
              <div className="stat-icon orange">
                <Flame className="w-6 h-6" />
              </div>
              <div className="stat-value" style={{ color: '#92400E' }}>{streak.currentStreak}</div>
              <div className="stat-label">Day Streak</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Progress Chart */}
            <div className="stagger-item glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Weekly Progress</h3>
                <Link to="/analytics" className="text-sm text-green-800 hover:text-green-800 flex items-center gap-1">
                  View All <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="missed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="stagger-item glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Status Distribution</h3>
              </div>
              <div className="h-56 flex items-center justify-center">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-400">
                    <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No data yet</p>
                  </div>
                )}
              </div>
              <div className="flex justify-center flex-wrap gap-3 mt-2">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's Progress */}
          <div className="stagger-item glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-800 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Today's Progress</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <Link
                to="/schedule"
                className="px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-medium hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
              >
                View Schedule
              </Link>
            </div>

            {todayProgress.length > 0 ? (
              <div className="space-y-3">
                {todayProgress.slice(0, 5).map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: (item.learningObjective?.color || '#4A7C59') + '20' }}
                      >
                        {getStatusIcon(item.status)}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-100">
                          {item.learningObjective?.title || 'Unknown Objective'}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.learningObjective?.category || 'General'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">No tasks scheduled for today</p>
                <Link
                  to="/schedule"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Schedule
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Calendar & Incomplete */}
        <div className="space-y-6">
          {/* Calendar */}
          <div className="stagger-item glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="calendar-grid">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-2">
                  {day}
                </div>
              ))}
              {getDaysInMonth(calendarDate).map((item, index) => {
                const status = getDayStatus(item.date);
                return (
                  <div
                    key={index}
                    className={`calendar-day ${item.currentMonth ? '' : 'other-month'} ${isToday(item) ? 'today' : ''} relative`}
                  >
                    {item.day}
                    {status && (
                      <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${status === 'success'
                          ? 'bg-green-500'
                          : status === 'danger'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                          }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incomplete Tasks */}
          <div className="stagger-item glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Incomplete</h3>
              <MoreHorizontal className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {todayProgress
                .filter((item) => item.status !== 'completed')
                .slice(0, 4)
                .map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                    <div
                      className="w-1 h-10 rounded-full"
                      style={{ backgroundColor: item.learningObjective?.color || '#4A7C59' }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-800 dark:text-gray-100">
                        {item.learningObjective?.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.learningObjective?.category}
                      </p>
                    </div>
                  </div>
                ))}
              {todayProgress.filter((item) => item.status !== 'completed').length === 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 py-4 text-sm">
                  All of today's tasks are completed. 🎉
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="stagger-item space-y-3">
            <Link
              to="/objectives"
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Target className="w-6 h-6 text-green-800" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-gray-100">Objectives</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{objectives.length} active goals</div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </Link>

            <Link
              to="/schedule"
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-800" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-gray-100">Schedule</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Plan your week</div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </Link>

            <Link
              to="/ai-assistant"
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-800 text-white  hover:transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">AI Assistant</div>
                <div className="text-sm text-white/80">Get smart suggestions</div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/80" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
