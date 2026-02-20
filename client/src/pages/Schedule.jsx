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
  FileText
} from 'lucide-react';

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
  const [todayProgress, setTodayProgress] = useState([]);

  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    description: ''
  });

  const [notesForm, setNotesForm] = useState({
    notes: ''
  });

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

  const handleMarkComplete = async (objectiveId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await progressAPI.createOrUpdate({
        learningObjectiveId: objectiveId,
        date: today,
        status: 'completed'
      });
      
      setSelectedProgress(response.data.data);
      setNotesForm({ notes: '' });
      setShowNotesModal(true);
      fetchData();
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  const handleSaveNotes = async () => {
    try {
      if (!selectedProgress) return;

      const today = new Date().toISOString().split('T')[0];
      await progressAPI.createOrUpdate({
        learningObjectiveId: selectedProgress.learningObjective?._id || selectedProgress.learningObjective,
        date: today,
        status: 'completed',
        notes: notesForm.notes
      });
      
      toast.success('Notes saved!');
      setShowNotesModal(false);
      setSelectedProgress(null);
      setNotesForm({ notes: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to save notes');
    }
  };

  const handleSkip = async (objectiveId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
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

  const handleMarkMissed = async (objectiveId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await progressAPI.createOrUpdate({
        learningObjectiveId: objectiveId,
        date: today,
        status: 'missed',
        remarks: 'Marked as missed by user'
      });
      
      toast.success('Marked as missed');
      fetchData();
    } catch (error) {
      toast.error('Failed to mark as missed');
    }
  };

  const getObjectiveById = (id) => objectives.find(o => o._id === id);

  const getProgressForObjective = (objectiveId) => {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Weekly Schedule</h2>
          <p className="text-gray-500">Plan and manage your learning schedule</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-indigo-200 transition-all"
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
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedSchedule?._id === schedule._id
                    ? 'bg-indigo-600 text-white shadow-md'
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
            <div className="flex flex-wrap gap-2">
              {days.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
                    selectedDay === day
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md'
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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 capitalize">{selectedDay}</h3>
                  <p className="text-sm text-gray-500">
                    {getDaySchedule().length} items scheduled
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Objective
              </button>
            </div>

            {getDaySchedule().length > 0 ? (
              <div className="space-y-3">
                {getDaySchedule().map((item, index) => {
                  const objective = getObjectiveById(item.learningObjective?._id || item.learningObjective);
                  const progress = getProgressForObjective(item.learningObjective?._id || item.learningObjective);
                  
                  if (!objective) return null;

                  const hasStatus = progress && (progress.status === 'completed' || progress.status === 'skipped' || progress.status === 'missed');

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: objective.color + '20' }}
                        >
                          <BookOpen className="w-5 h-5" style={{ color: objective.color }} />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-800">{objective.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
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

                      <div className="flex items-center gap-2">
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
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
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
                              className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium hover:bg-purple-200 transition-colors"
                            >
                              Skip
                            </button>
                            <button
                              onClick={() => handleMarkMissed(objective._id)}
                              className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors"
                            >
                              Missed
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
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
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="e.g., My Learning Plan"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
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
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
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
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-indigo-50 transition-colors text-left"
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
                  <Link to="/objectives" className="text-indigo-600 hover:underline mt-2 inline-block">
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

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Great job!</h3>
                <p className="text-sm text-gray-500">What did you learn today?</p>
              </div>
            </div>
            
            <textarea
              value={notesForm.notes}
              onChange={(e) => setNotesForm({ notes: e.target.value })}
              rows={5}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none mb-4"
              placeholder="Write about what you learned, key takeaways, or any notes you want to remember..."
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedProgress(null);
                  setNotesForm({ notes: '' });
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSaveNotes}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
