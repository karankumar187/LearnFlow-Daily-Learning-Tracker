import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { scheduleAPI, objectivesAPI, progressAPI } from '../services/api';
import { toast } from 'sonner';
import {
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  Trash2,
  Save,
  SkipForward,
  BookOpen,
  FileText,
  ExternalLink
} from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const Schedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedDay, setSelectedDay] = useState(days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedProgress, setSelectedProgress] = useState(null);
  const [pendingCompleteId, setPendingCompleteId] = useState(null);
  const [todayProgress, setTodayProgress] = useState([]);

  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    description: ''
  });

  const [notesForm, setNotesForm] = useState({
    notes: '',
    timeSpent: ''
  });

  useGSAP(() => {
    if (!loading && selectedSchedule) {
      gsap.fromTo('.stagger-item',
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.05,
          ease: 'power2.out',
          clearProps: 'all'
        }
      );
    }
  }, [loading, selectedSchedule, selectedDay]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, objectivesRes, todayRes] = await Promise.all([
        scheduleAPI.getAll(),
        objectivesAPI.getAll({ isActive: true }),
        progressAPI.getDaily()
      ]);

      setSchedules(schedulesRes.data.data);
      setObjectives(objectivesRes.data.data);
      setTodayProgress(todayRes.data.data || []);

      const defaultSchedule = schedulesRes.data.data.find(s => s.isDefault);
      if (defaultSchedule) {
        setSelectedSchedule(defaultSchedule);
      } else if (schedulesRes.data.data.length > 0) {
        setSelectedSchedule(schedulesRes.data.data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      const weeklySchedule = days.map(day => ({
        day,
        items: [],
        isActive: true
      }));

      await scheduleAPI.create({
        ...scheduleForm,
        weeklySchedule,
        isDefault: schedules.length === 0
      });

      toast.success('Schedule created successfully');
      setShowCreateModal(false);
      setScheduleForm({ name: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create schedule');
    }
  };

  const handleAddItem = async (objectiveId) => {
    try {
      if (!selectedSchedule) return;

      await scheduleAPI.addItemToDay(selectedSchedule._id, selectedDay, {
        learningObjectiveId: objectiveId
      });

      toast.success('Objective added to schedule');
      setShowAddItemModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add item');
    }
  };

  const handleRemoveItem = async (objectiveId) => {
    try {
      if (!selectedSchedule) return;

      await scheduleAPI.removeItemFromDay(selectedSchedule._id, selectedDay, objectiveId);
      toast.success('Item removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleSetDefault = async (scheduleId) => {
    try {
      await scheduleAPI.setDefault(scheduleId);
      toast.success('Default schedule updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update default schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await scheduleAPI.delete(scheduleId);
      toast.success('Schedule deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  const isTodayTab = () => {
    const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const todayName = days[todayIndex];
    return selectedDay === todayName;
  };

  const handleMarkComplete = (objectiveId) => {
    if (!isTodayTab()) {
      toast.error('You can only complete objectives for today from this view.');
      return;
    }
    // Don't call the API yet — just open the confirmation modal
    setPendingCompleteId(objectiveId);
    setNotesForm({ notes: '', timeSpent: '' });
    setShowNotesModal(true);
  };

  const handleConfirmComplete = async () => {
    try {
      if (!pendingCompleteId) return;

      const d = new Date();
      const today = `${d.getFullYear()} -${String(d.getMonth() + 1).padStart(2, '0')} -${String(d.getDate()).padStart(2, '0')} `;

      // Parse time spent — accept minutes as number
      const timeSpentMinutes = notesForm.timeSpent ? parseInt(notesForm.timeSpent, 10) : undefined;

      await progressAPI.createOrUpdate({
        learningObjectiveId: pendingCompleteId,
        date: today,
        status: 'completed',
        notes: notesForm.notes || undefined,
        timeSpent: timeSpentMinutes && !isNaN(timeSpentMinutes) ? timeSpentMinutes : undefined
      });

      // Celebration animation on completion
      gsap.fromTo(
        `[data - objective - id= "${pendingCompleteId}"]`,
        { scale: 0.9, boxShadow: '0 0 0 rgba(34,197,94,0)' },
        {
          scale: 1.06,
          boxShadow: '0 0 35px rgba(34,197,94,0.75)',
          duration: 0.5,
          yoyo: true,
          repeat: 2,
          ease: 'power3.out',
        }
      );

      toast.success('Marked as completed!');
      setShowNotesModal(false);
      setPendingCompleteId(null);
      setNotesForm({ notes: '', timeSpent: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  const handleCancelComplete = () => {
    setShowNotesModal(false);
    setPendingCompleteId(null);
    setNotesForm({ notes: '', timeSpent: '' });
  };

  const handleSkip = async (objectiveId) => {
    try {
      if (!isTodayTab()) {
        toast.error('You can only skip objectives for today from this view.');
        return;
      }
      const d = new Date();
      const today = `${d.getFullYear()} -${String(d.getMonth() + 1).padStart(2, '0')} -${String(d.getDate()).padStart(2, '0')} `;
      await progressAPI.skip({
        learningObjectiveId: objectiveId,
        date: today,
        remarks: 'Skipped by user'
      });

      toast.success('Marked as skipped');
      fetchData();
    } catch (error) {
      toast.error('Failed to skip');
    }
  };

  const getObjectiveById = (id) => objectives.find(o => o._id === id);

  const getProgressForObjective = (objectiveId) => {
    const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const todayName = days[todayIndex];
    // Only show / use progress when viewing today's schedule
    if (selectedDay !== todayName) return undefined;
    return todayProgress.find(p => p.learningObjective?._id === objectiveId);
  };

  const getDaySchedule = () => {
    if (!selectedSchedule) return [];
    const daySchedule = selectedSchedule.weeklySchedule.find(s => s.day === selectedDay);
    return daySchedule?.items || [];
  };

  const getAvailableObjectives = () => {
    const scheduledIds = getDaySchedule().map(item => item.learningObjective?._id || item.learningObjective);
    return objectives.filter(o => !scheduledIds.includes(o._id));
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
      <div className="stagger-item flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Weekly Schedule</h2>
          <p className="text-gray-500 dark:text-gray-400">Plan and manage your learning schedule</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-800 text-white font-medium  transition-all"
        >
          <Plus className="w-5 h-5" />
          New Schedule
        </button>
      </div>

      {/* Schedule Selector */}
      {schedules.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="flex flex-wrap gap-2">
            {schedules.map(schedule => (
              <button
                key={schedule._id}
                onClick={() => setSelectedSchedule(schedule)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedSchedule?._id === schedule._id
                  ? 'bg-green-700 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {schedule.name}
                {schedule.isDefault && (
                  <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedSchedule ? (
        <>
          {/* Schedule Actions */}
          <div className="flex flex-wrap gap-2">
            {!selectedSchedule.isDefault && (
              <button
                onClick={() => handleSetDefault(selectedSchedule._id)}
                className="px-4 py-2 rounded-lg bg-green-100 text-green-700 font-medium hover:bg-green-200 transition-colors"
              >
                Set as Default
              </button>
            )}
            <button
              onClick={() => handleDeleteSchedule(selectedSchedule._id)}
              className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors"
            >
              Delete Schedule
            </button>
          </div>

          {/* Day Selector */}
          <div className="glass-card rounded-xl p-4">
            <div className="stagger-item flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-2">
              {days.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${selectedDay === day
                    ? 'bg-gray-800 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Day's Schedule */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-800" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 capitalize">{selectedDay}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getDaySchedule().length} items scheduled
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Objective
              </button>
            </div>

            {getDaySchedule().length > 0 ? (
              <div className="space-y-3">
                {getDaySchedule().map((item, index) => {
                  const objectiveId = item.learningObjective?._id || item.learningObjective;
                  const objective = getObjectiveById(objectiveId);
                  const progress = getProgressForObjective(objectiveId);

                  if (!objective) return null;

                  return (
                    <div
                      key={`${item._id}-${index}`}
                      data-objective-id={objectiveId}
                      className="stagger-item flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: objective.color + '20' }}
                        >
                          <BookOpen className="w-5 h-5" style={{ color: objective.color }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-800 dark:text-gray-100">{objective.title}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{objective.category}</span>
                            <span>•</span>
                            <span>{objective.estimatedTime} min</span>
                          </div>
                          {progress?.notes && (
                            <div className="flex items-center gap-1 mt-1">
                              <FileText className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-400 line-clamp-1">{progress.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {objective.url && (
                          <a
                            href={objective.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                            title="Open Learning Resource"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Link
                          </a>
                        )}
                        {progress?.status === 'completed' && (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                              <CheckCircle className="w-4 h-4" />
                              Completed
                            </span>
                            <button
                              onClick={() => handleRemoveItem(objective._id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        )}
                        {progress?.status === 'skipped' && (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                              <SkipForward className="w-4 h-4" />
                              Skipped
                            </span>
                            <button
                              onClick={() => handleRemoveItem(objective._id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        )}
                        {progress?.status === 'missed' && (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                              <XCircle className="w-4 h-4" />
                              Missed
                            </span>
                            <button
                              onClick={() => handleRemoveItem(objective._id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        )}
                        {(!progress || progress.status === 'pending') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMarkComplete(objective._id)}
                              className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-sm font-medium hover:bg-green-200 transition-colors"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleSkip(objective._id)}
                              className="px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-sm font-medium hover:bg-green-200 transition-colors"
                            >
                              Skip
                            </button>
                            <button
                              onClick={() => handleRemoveItem(objective._id)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-4">No items scheduled for {selectedDay}</p>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add First Item
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No schedules yet</h3>
          <p className="text-gray-500 mb-4">Create your first schedule to start planning</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Schedule
          </button>
        </div>
      )}

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Create New Schedule</h3>

            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Name</label>
                <input
                  type="text"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                  placeholder="e.g., My Learning Plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 outline-none transition-all resize-none"
                  placeholder="Brief description of your schedule"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Add Objective to {selectedDay}</h3>

            <div className="space-y-2">
              {getAvailableObjectives().length > 0 ? (
                getAvailableObjectives().map((objective) => (
                  <button
                    key={objective._id}
                    onClick={() => handleAddItem(objective._id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-green-50 transition-colors text-left"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: objective.color + '20' }}
                    >
                      <BookOpen className="w-5 h-5" style={{ color: objective.color }} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{objective.title}</h4>
                      <p className="text-sm text-gray-500">{objective.category} • {objective.estimatedTime} min</p>
                    </div>
                    <Plus className="w-5 h-5 text-gray-400" />
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No available objectives</p>
                  <Link to="/objectives" className="text-green-800 hover:underline mt-2 inline-block">
                    Create new objective
                  </Link>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAddItemModal(false)}
              className="w-full mt-4 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Completion Confirmation Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Complete this task?</h3>
                <p className="text-sm text-gray-500">Add an optional note about what you learned</p>
              </div>
            </div>

            {/* Time Spent */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Spent <span className="text-gray-400 font-normal">(minutes)</span>
              </label>
              <input
                type="number"
                min={1}
                max={600}
                value={notesForm.timeSpent}
                onChange={(e) => setNotesForm({ ...notesForm, timeSpent: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                placeholder="e.g. 45"
              />
            </div>

            {/* Notes */}
            <textarea
              value={notesForm.notes}
              onChange={(e) => setNotesForm({ ...notesForm, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-green-700 focus:ring-2 focus:ring-green-200 outline-none transition-all resize-none mb-4"
              placeholder="What did you learn? (optional)"
            />

            <div className="flex gap-3">
              <button
                onClick={handleCancelComplete}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmComplete}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
