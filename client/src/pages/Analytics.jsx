import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';
import { toast } from 'sonner';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  Calendar,
  TrendingUp,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Flame,
  Award,
  Download,
  ChevronDown
} from 'lucide-react';

const periodOptions = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all', label: 'All Time' }
];

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6FAF82', '#3b82f6'];

// Converts raw minutes to a human-readable string e.g. 90 → "1h 30m", 45 → "45m", 120 → "2h"
const formatTime = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const Analytics = () => {
  const [period, setPeriod] = useState('weekly');
  const [overallStats, setOverallStats] = useState(null);
  const [objectiveStats, setObjectiveStats] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [streakInfo, setStreakInfo] = useState(null);
  const [weeklyChartData, setWeeklyChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedObjective, setSelectedObjective] = useState(null);

  useGSAP(() => {
    if (!loading && overallStats) {
      gsap.from('.stagger-item', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'all'
      });
    }
  }, [loading, overallStats]);

  // One-time cleanup on mount: remove phantom entries AND deduplicate existing records
  useEffect(() => {
    analyticsAPI.cleanupPhantom().catch(() => { }); // silent
    analyticsAPI.dedup().catch(() => { });           // removes existing duplicates
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [period]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const [overallRes, objectiveRes, categoryRes, streakRes, weeklyRes] = await Promise.all([
        analyticsAPI.getOverall(period),
        analyticsAPI.getByObjective(),
        analyticsAPI.getByCategory(),
        analyticsAPI.getStreak(),
        analyticsAPI.getWeeklyChart()
      ]);

      setOverallStats(overallRes.data.data);
      setObjectiveStats(objectiveRes.data.data);
      setCategoryStats(categoryRes.data.data);
      setStreakInfo(streakRes.data.data);
      setWeeklyChartData(weeklyRes.data.data);
    } catch (error) {
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusDistribution = () => {
    if (!overallStats) return [];
    return [
      { name: 'Completed', value: overallStats.completed, color: '#10b981' },
      { name: 'Missed', value: overallStats.missed, color: '#ef4444' },
      { name: 'Pending', value: overallStats.pending, color: '#f59e0b' },
      { name: 'Partial', value: overallStats.partial, color: '#6FAF82' }
    ].filter(item => item.value > 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
          <p className="text-gray-500">Track your learning progress and performance</p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 outline-none transition-all bg-white"
          >
            {periodOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => toast.info('Export feature coming soon!')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {overallStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stagger-item stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#E8F2EC" }}>
                <Target className="w-5 h-5 text-green-800" />
              </div>
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{overallStats.total}</div>
            <div className="text-sm text-gray-500">Tasks</div>
          </div>

          <div className="stagger-item stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#E8F2EC" }}>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs text-green-600">+{overallStats.completed}</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{overallStats.completed}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>

          <div className="stagger-item stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#E8F2EC" }}>
                <TrendingUp className="w-5 h-5 text-green-800" />
              </div>
              <span className="text-xs text-gray-500">Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{overallStats.completionRate}%</div>
            <div className="text-sm text-gray-500">Completion</div>
          </div>

          <div className="stagger-item stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FDEBD0" }}>
                <Clock className="w-5 h-5 text-amber-800" />
              </div>
              <span className="text-xs text-gray-500">Time</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">{formatTime(overallStats.totalTimeSpent)}</div>
            <div className="text-sm text-gray-500">Time Spent</div>
          </div>
        </div>
      )}

      {/* Streak Card */}
      {streakInfo && (
        <div className="stagger-item glass-card rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: '#FDEBD0' }}>
                <Flame className="w-7 h-7" style={{ color: '#D97706' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {streakInfo.currentStreak} Day Streak! 🔥
                </h3>
                <p className="text-gray-500">
                  Longest streak: {streakInfo.longestStreak} days • Total completed days: {streakInfo.totalCompletedDays}
                </p>
              </div>
            </div>
            <div className="hidden sm:block">
              <Award className="w-12 h-12 text-yellow-500" />
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Progress Chart */}
        <div className="stagger-item glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Weekly Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatTime(v)} />
                <Tooltip
                  contentStyle={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value, name) => {
                    if (name === 'Time') {
                      return [formatTime(value), 'Time Spent'];
                    }
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="completed" fill="#52B788" radius={[4, 4, 0, 0]} name="Completed" />
                <Bar yAxisId="left" dataKey="missed" fill="#EF4444" radius={[4, 4, 0, 0]} name="Missed" />
                <Line yAxisId="right" type="monotone" dataKey="timeSpentMinutes" stroke="#D97706" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Time" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="stagger-item glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Status Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getStatusDistribution()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {getStatusDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center flex-wrap gap-4 mt-4">
            {getStatusDistribution().map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Objective Performance */}
      <div className="stagger-item glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Objective Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Objective</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Total</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Completed</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Missed</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Rate</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Time (hrs)</th>
              </tr>
            </thead>
            <tbody>
              {objectiveStats.map((stat) => (
                <tr
                  key={stat.objective.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedObjective(stat)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: stat.objective.color + '20' }}
                      >
                        <Target className="w-4 h-4" style={{ color: stat.objective.color }} />
                      </div>
                      <span className="font-medium text-gray-800">{stat.objective.title}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-600">{stat.stats.total}</td>
                  <td className="text-center py-3 px-4 text-green-600">{stat.stats.completed}</td>
                  <td className="text-center py-3 px-4 text-red-600">{stat.stats.missed}</td>
                  <td className="text-center py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${stat.stats.completionRate >= 80 ? 'bg-green-100 text-green-700' :
                      stat.stats.completionRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {stat.stats.completionRate}%
                    </span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {Math.round(stat.stats.totalTimeSpent / 60)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Performance */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Performance by Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryStats.map((cat) => (
            <div key={cat.category} className="p-4 rounded-xl bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-800">{cat.category}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${cat.completionRate >= 80 ? 'bg-green-100 text-green-700' :
                  cat.completionRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                  {cat.completionRate}%
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tasks</span>
                  <span className="text-gray-700">{cat.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Completed</span>
                  <span className="text-green-600">{cat.completed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Time</span>
                  <span className="text-gray-700">{formatTime(cat.totalTimeSpent)}</span>
                </div>
              </div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 transition-all"
                  style={{ width: `${cat.completionRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Objective Detail Modal */}
      {selectedObjective && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedObjective.objective.color + '20' }}
                >
                  <Target className="w-5 h-5" style={{ color: selectedObjective.objective.color }} />
                </div>
                <h3 className="text-xl font-bold text-gray-800">{selectedObjective.objective.title}</h3>
              </div>
              <button
                onClick={() => setSelectedObjective(null)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-gray-50 text-center">
                <div className="text-2xl font-bold text-gray-800">{selectedObjective.stats.total}</div>
                <div className="text-sm text-gray-500">Total Tasks</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 text-center">
                <div className="text-2xl font-bold text-green-600">{selectedObjective.stats.completed}</div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 text-center">
                <div className="text-2xl font-bold text-green-800">{selectedObjective.stats.completionRate}%</div>
                <div className="text-sm text-gray-500">Completion Rate</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 text-center">
                <div className="text-2xl font-bold text-amber-800">{formatTime(selectedObjective.stats.totalTimeSpent)}</div>
                <div className="text-sm text-gray-500">Time Spent</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Recent Activity</h4>
              {selectedObjective.stats.completed > 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-700">Completed {selectedObjective.stats.completed} tasks</span>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No activity recorded yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
