import React, { useState, useEffect } from 'react';
import { objectivesAPI, progressAPI } from '../services/api';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BookOpen,
  Code,
  Music,
  Palette,
  Dumbbell,
  Languages,
  Calculator,
  Beaker,
  Globe,
  ChevronLeft,
  ChevronRight,
  X,
  FileText
} from 'lucide-react';

const iconOptions = [
  { value: 'Book', icon: BookOpen, label: 'Book' },
  { value: 'Code', icon: Code, label: 'Code' },
  { value: 'Music', icon: Music, label: 'Music' },
  { value: 'Art', icon: Palette, label: 'Art' },
  { value: 'Fitness', icon: Dumbbell, label: 'Fitness' },
  { value: 'Language', icon: Languages, label: 'Language' },
  { value: 'Math', icon: Calculator, label: 'Math' },
  { value: 'Science', icon: Beaker, label: 'Science' },
  { value: 'General', icon: Target, label: 'General' },
  { value: 'Globe', icon: Globe, label: 'Globe' },
];

const colorOptions = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#3b82f6'
];

const Objectives = () => {
  const [objectives, setObjectives] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [progressData, setProgressData] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    estimatedTime: 60,
    color: '#6366f1',
    icon: 'Book'
  });

  useEffect(() => {
    fetchObjectives();
    fetchCategories();
  }, []);

  const fetchObjectives = async () => {
    try {
      setLoading(true);
      // Only show active objectives so soft-deleted ones disappear from the list
      const response = await objectivesAPI.getAll({ isActive: true });
      setObjectives(response.data.data);
    } catch (error) {
      toast.error('Failed to fetch objectives');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await objectivesAPI.getCategories();
      setCategories(response.data.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingObjective) {
        await objectivesAPI.update(editingObjective._id, formData);
        toast.success('Objective updated successfully');
      } else {
        await objectivesAPI.create(formData);
        toast.success('Objective created successfully');
      }
      setShowModal(false);
      setEditingObjective(null);
      resetForm();
      fetchObjectives();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this objective?')) return;
    
    try {
      await objectivesAPI.delete(id);
      toast.success('Objective deleted successfully');
      fetchObjectives();
    } catch (error) {
      toast.error('Failed to delete objective');
    }
  };

  const handleEdit = (objective) => {
    setEditingObjective(objective);
    setFormData({
      title: objective.title,
      description: objective.description || '',
      category: objective.category,
      priority: objective.priority,
      estimatedTime: objective.estimatedTime,
      color: objective.color,
      icon: objective.icon
    });
    setShowModal(true);
  };

  const handleViewProgress = async (objective) => {
    try {
      const response = await objectivesAPI.getWithProgress(objective._id, {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      });
      setSelectedObjective(response.data.data.objective);
      setProgressData(response.data.data.progress);
      setShowProgressModal(true);
    } catch (error) {
      toast.error('Failed to fetch progress data');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      priority: 'medium',
      estimatedTime: 60,
      color: '#6366f1',
      icon: 'Book'
    });
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return 'priority-medium';
    }
  };

  const getIconComponent = (iconName) => {
    const iconOption = iconOptions.find(i => i.value === iconName);
    return iconOption ? iconOption.icon : BookOpen;
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

  const filteredObjectives = objectives.filter(obj => {
    const matchesSearch = obj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         obj.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || obj.category === filterCategory;
    const matchesPriority = filterPriority === 'all' || obj.priority === filterPriority;
    return matchesSearch && matchesCategory && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Learning Objectives</h2>
          <p className="text-gray-500 dark:text-gray-400">Manage your learning goals and track progress</p>
        </div>
        <button
          onClick={() => {
            setEditingObjective(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-indigo-200 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Objective
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search objectives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Objectives Grid */}
      {filteredObjectives.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredObjectives.map((objective) => {
            const IconComponent = getIconComponent(objective.icon);
            return (
              <div
                key={objective._id}
                className="glass-card rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => handleViewProgress(objective)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: objective.color + '20' }}
                  >
                    <IconComponent className="w-6 h-6" style={{ color: objective.color }} />
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(objective)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(objective._id)}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-1">{objective.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{objective.description}</p>

                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getPriorityClass(objective.priority)}`}>
                    {objective.priority}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{objective.estimatedTime} min</span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{objective.category}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center">
          <Target className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No objectives found</h3>
          <p className="text-gray-500 mb-4">Create your first learning objective to get started</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Objective
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              {editingObjective ? 'Edit Objective' : 'Add New Objective'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="form-input"
                  placeholder="Enter objective title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Enter description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    list="categories"
                    className="form-input"
                    placeholder="Enter or select category"
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="form-input"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  value={formData.estimatedTime}
                  onChange={(e) => setFormData({ ...formData, estimatedTime: parseInt(e.target.value) })}
                  min={5}
                  max={480}
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                <div className="grid grid-cols-5 gap-2">
                  {iconOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: option.value })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          formData.icon === option.value
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  {editingObjective ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && selectedObjective && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedObjective.color + '20' }}
                >
                  {React.createElement(getIconComponent(selectedObjective.icon), {
                    className: 'w-5 h-5',
                    style: { color: selectedObjective.color }
                  })}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{selectedObjective.title}</h3>
                  <p className="text-sm text-gray-500">Last 30 days progress</p>
                </div>
              </div>
              <button
                onClick={() => setShowProgressModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {progressData.length > 0 ? (
              <div className="space-y-3">
                {progressData.map((progress) => (
                  <div
                    key={progress._id}
                    className="p-4 rounded-xl bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(progress.status)}
                        <div>
                          <p className="font-medium text-gray-800">
                            {new Date(progress.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(progress.status)}`}>
                        {progress.status}
                      </span>
                    </div>
                    
                    {progress.notes && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                          <FileText className="w-4 h-4" />
                          <span className="text-xs font-medium">Learning Notes</span>
                        </div>
                        <p className="text-sm text-gray-700">{progress.notes}</p>
                      </div>
                    )}
                    
                    {progress.remarks && !progress.notes && (
                      <p className="text-sm text-gray-500 mt-2">{progress.remarks}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No progress data available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Objectives;
