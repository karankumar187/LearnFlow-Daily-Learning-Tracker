import axios from 'axios';

// Use VITE_API_URL for build-time config (set in Render dashboard for frontend service)
// Fallback for local dev when .env has VITE_API_URL=http://localhost:5000/api
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data)
};

// Learning Objectives APIs
export const objectivesAPI = {
  getAll: (params) => api.get('/objectives', { params }),
  getById: (id) => api.get(`/objectives/${id}`),
  create: (data) => api.post('/objectives', data),
  update: (id, data) => api.put(`/objectives/${id}`, data),
  delete: (id) => api.delete(`/objectives/${id}`),
  getCategories: () => api.get('/objectives/categories/all'),
  getWithProgress: (id, params) => api.get(`/objectives/${id}/progress`, { params })
};

// Progress APIs
export const progressAPI = {
  createOrUpdate: (data) => api.post('/progress', data),
  getDaily: (date) => api.get('/progress/daily', { params: { date } }),
  getRange: (startDate, endDate) => api.get('/progress/range', { params: { startDate, endDate } }),
  getByObjective: (objectiveId, params) => api.get(`/progress/objective/${objectiveId}`, { params }),
  skip: (data) => api.post('/progress/skip', data),
  markMissed: () => api.post('/progress/mark-missed'),
  delete: (id) => api.delete(`/progress/${id}`)
};

// Schedule APIs
export const scheduleAPI = {
  getAll: () => api.get('/schedules'),
  getById: (id) => api.get(`/schedules/${id}`),
  create: (data) => api.post('/schedules', data),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
  getDefault: () => api.get('/schedules/default'),
  setDefault: (id) => api.put(`/schedules/${id}/set-default`),
  getToday: () => api.get('/schedules/today'),
  updateDay: (id, day, data) => api.put(`/schedules/${id}/day/${day}`, data),
  addItemToDay: (id, day, data) => api.post(`/schedules/${id}/day/${day}/item`, data),
  removeItemFromDay: (id, day, objectiveId) => api.delete(`/schedules/${id}/day/${day}/item/${objectiveId}`)
};

// Analytics APIs
export const analyticsAPI = {
  getOverall: (period) => api.get('/analytics/overall', { params: { period } }),
  getByObjective: (params) => api.get('/analytics/by-objective', { params }),
  getDaily: (month, year) => api.get('/analytics/daily', { params: { month, year } }),
  getStreak: () => api.get('/analytics/streak'),
  getWeeklyChart: () => api.get('/analytics/weekly-chart'),
  getByCategory: (params) => api.get('/analytics/by-category', { params })
};

// AI Assistant APIs
export const aiAPI = {
  suggestSchedule: (data) => api.post('/ai/suggest-schedule', data),
  applySuggestion: (suggestionId, data) => api.post(`/ai/apply-suggestion/${suggestionId}`, data),
  getSuggestions: () => api.get('/ai/suggestions'),
  getSuggestion: (id) => api.get(`/ai/suggestions/${id}`),
  updateSuggestion: (id, data) => api.put(`/ai/suggestions/${id}`, data),
  deleteSuggestion: (id) => api.delete(`/ai/suggestions/${id}`),
  chat: (data) => api.post('/ai/chat', data)
};

// Feedback APIs
export const feedbackAPI = {
  submit: (data) => api.post('/feedback', data)
};

export default api;
