import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, progressAPI, objectivesAPI } from '../services/api';
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
  ChevronRight
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

const getTodayInIST = () => {
  const istString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(istString);
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
  const [currentDate] = useState(getTodayInIST());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [dailyAnalytics, setDailyAnalytics] = useState({});

  const welcomeRef = useRef(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchCalendarAnalytics(calendarDate);
  }, [calendarDate]);

  useEffect(() => {
    const todayKey = new Date().toISOString().split('T')[0];
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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [overallRes, streakRes, dailyRes, objectivesRes, weeklyRes] = await Promise.all([
        analyticsAPI.getOverall('weekly'),
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
    const today = getTodayInIST();
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
        return <Clock className="w-5 h-5 text-purple-500" />;
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
        return 'bg-purple-100 text-purple-700';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn" ref={welcomeRef}>
      {/* Welcome Section with Date */}
      <div className="glass-card rounded-2xl p-6 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-slate-800/60 dark:to-slate-900/60">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4" data-welcome-anim>
          <div data-welcome-anim>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">{formatDate(currentDate)}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Welcome back!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Here's your learning progress for this week
            </p>
          </div>
          <Link
            to="/ai-assistant"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-indigo-200 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            Get AI Schedule
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Stats & Charts */}
        <div className="xl:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="stat-icon blue">
                <Target className="w-6 h-6" />
              </div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Tasks</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div className="stat-value text-green-600">{stats.completed}</div>
              <div className="stat-label">Completed</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon purple">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="stat-value text-indigo-600">{stats.completionRate}%</div>
              <div className="stat-label">Completion</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">
                <Flame className="w-6 h-6" />
              </div>
              <div className="stat-value text-orange-600">{streak.currentStreak}</div>
              <div className="stat-label">Day Streak</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Progress Chart */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Weekly Progress</h3>
                <Link to="/analytics" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
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
            <div className="glass-card rounded-xl p-6">
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
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
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
                className="px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 font-medium hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
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
                        style={{ backgroundColor: (item.learningObjective?.color || '#6366f1') + '20' }}
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
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
          <div className="glass-card rounded-xl p-6">
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
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                          status === 'success'
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
          <div className="glass-card rounded-xl p-6">
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
                      style={{ backgroundColor: item.learningObjective?.color || '#6366f1' }}
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
          <div className="space-y-3">
            <Link
              to="/objectives"
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Target className="w-6 h-6 text-indigo-600" />
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
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800 dark:text-gray-100">Schedule</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Plan your week</div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </Link>

            <Link
              to="/ai-assistant"
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200 hover:shadow-xl transition-shadow"
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
