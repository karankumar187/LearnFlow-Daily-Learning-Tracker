import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import LogoIcon from './LogoIcon';
import {
  LayoutDashboard,
  Target,
  Calendar,
  BarChart3,
  Sparkles,
  LogOut,
  Menu,
  X,
  User,
  Settings,
  Bell,
  ChevronRight,
  FileText
} from 'lucide-react';
import Footer from './layout/Footer';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [theme, setTheme] = useState('light');
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = async () => {
    try {
      if (!user) return;
      const res = await notificationsAPI.getAll();
      setNotifications(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('theme') || 'light';
    setTheme(stored);
    document.documentElement.classList.toggle('dark', stored === 'dark');

    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Re-fetch when notification panel is opened, and trigger a pending reminder
  useEffect(() => {
    if (showNotifications && user) {
      fetchNotifications();
      // Silently trigger a pending-tasks check so reminders appear immediately
      notificationsAPI.triggerReminder()
        .then(() => fetchNotifications())
        .catch(() => { }); // ignore if no pending tasks
    }
  }, [showNotifications]);

  const handleMarkRead = async (id, read) => {
    if (read) return;
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/objectives', label: 'Objectives', icon: Target },
    { path: '/schedule', label: 'Schedule', icon: Calendar },
    { path: '/notes', label: 'Notes', icon: FileText },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/ai-assistant', label: 'AI Assistant', icon: Sparkles },
  ];

  const isActive = (path) => location.pathname === path;

  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;

  return (
    <div className="min-h-screen bg-[#F8F4EE] dark:bg-slate-950 transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-800 mb-2">Profile</h4>
                <p className="text-sm text-gray-500">Name: {user?.name}</p>
                <p className="text-sm text-gray-500">Email: {user?.email}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-800 mb-2">Preferences</h4>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Email Notifications</span>
                  <div className="w-12 h-6 bg-green-700 rounded-full relative cursor-pointer">
                    <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Daily Reminders</span>
                  <div className="w-12 h-6 bg-green-700 rounded-full relative cursor-pointer">
                    <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow"></div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-start justify-end p-4 pt-20">
          <div className="glass-card w-full max-w-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Notifications</h3>
              <div className="flex items-center gap-2">
                {notifications.some(n => !n.read) && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-gray-500 hover:text-gray-800 underline transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {!Array.isArray(notifications) || notifications.length === 0 ? (
                <div className="text-center text-sm text-gray-500 py-4">No notifications yet</div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif._id || Math.random()}
                    onClick={() => handleMarkRead(notif._id, notif.read)}
                    className={`p-3 rounded-xl ${notif.read ? 'bg-gray-50' : 'bg-green-50'} cursor-pointer hover:bg-gray-100 transition-colors border ${notif.read ? 'border-transparent' : 'border-green-100'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.read ? 'bg-gray-300' : 'bg-green-700'}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${notif.read ? 'font-medium text-gray-600' : 'font-semibold text-gray-800'}`}>{notif.title}</p>
                        <p className={`text-xs mt-0.5 ${notif.read ? 'text-gray-500' : 'text-gray-600'}`}>{notif.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                          {formatDistanceToNow(new Date(notif.createdAt || new Date()), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 backdrop-blur-xl border-r z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 bg-[#FAFAF8] dark:bg-slate-900 border-[#E4E8E5] dark:border-slate-800 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[#E4E8E5] dark:border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm p-2 bg-[#E8F2EC] dark:bg-green-900/30">
              <LogoIcon className="w-8 h-8" color="white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1A2E1F] dark:text-white">
                Avanza
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Master Your Learning</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-4">Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${active
                  ? 'shadow-sm bg-[#E8F2EC] text-[#1A2E1F] dark:bg-green-900/40 dark:text-green-300'
                  : 'text-[#5C6E62] dark:text-slate-400 hover:bg-[#EEF6F0] dark:hover:bg-slate-800 dark:hover:text-slate-200 hover:text-[#1A2E1F]'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.path === '/ai-assistant' && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-[#E8F2EC] text-[#1A2E1F] dark:bg-green-900/40 dark:text-green-300">
                    AI
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E4E8E5] dark:border-slate-800">
          <div className="rounded-xl p-4 bg-[#F8F4EE] dark:bg-slate-800/50">
            <div className="flex items-center gap-3 mb-3">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-green-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5 text-white" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-72 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl border-b bg-[#F8F4EE]/90 dark:bg-slate-950/90 border-[#E4E8E5] dark:border-slate-800">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {navItems.find((item) => isActive(item.path))?.label || 'Dashboard'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl transition-colors border border-[#C8DDD0] dark:border-slate-700 text-[#2D6A4F] dark:text-green-400 bg-transparent hover:bg-white/50 dark:hover:bg-slate-800"
              >
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={() => setShowNotifications(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                )}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8 flex-1">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Layout;
