import React, { useState } from 'react';
import { CheckSquare, Square, Calendar, Plus, Edit2, Trash2, Clock, AlertTriangle, User, Search, Filter, CheckCircle2 } from 'lucide-react';
import { Staff, StaffTask, staffApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';

interface StaffTasksViewProps {
  tasks: StaffTask[];
  staffList: Staff[];
  selectedStaff: Staff | null;
  isAdmin: boolean;
  onOpenAddModal: () => void;
  onEditTask: (task: StaffTask) => void;
  onRefresh: () => void;
}

const StaffTasksView: React.FC<StaffTasksViewProps> = ({
  tasks,
  staffList,
  selectedStaff,
  isAdmin,
  onOpenAddModal,
  onEditTask,
  onRefresh,
}) => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter tasks
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const filteredTasks = safeTasks.filter(t => {
    const matchesStaff = selectedStaff
      ? (
          (selectedStaff.id && t.assignedStaffId && String(t.assignedStaffId).trim() === String(selectedStaff.id).trim()) ||
          (selectedStaff.appUsername && t.assignedStaffId && String(t.assignedStaffId).trim().toLowerCase() === String(selectedStaff.appUsername).trim().toLowerCase()) ||
          t.assignedStaffId === 'ALL'
        )
      : true;
    const matchesStatus = statusFilter === 'ALL' ? true : t.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' ? true : t.priority === priorityFilter;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStaff && matchesStatus && matchesPriority && matchesSearch;
  });

  const handleToggleStatus = async (task: StaffTask) => {
    if (!task.id) return;
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    setTogglingId(task.id);
    try {
      const actorName = user?.name || user?.role || 'Staff';
      await staffApi.updateTaskStatus(task.id, newStatus, actorName);
      toast.success(newStatus === 'COMPLETED' ? 'Task marked as Completed! 🎉' : 'Task marked as Pending.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update task status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    setDeletingId(id);
    try {
      await staffApi.deleteTask(id);
      toast.success('Task deleted successfully.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete task.');
    } finally {
      setDeletingId(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">Urgent</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">High</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">Low</span>;
    }
  };

  const isOverdue = (dueDateStr?: string, status?: string) => {
    if (!dueDateStr || status === 'COMPLETED') return false;
    const due = new Date(dueDateStr);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <CheckSquare className="text-emerald-600" size={22} />
              <span>Staff To-Do Tasks & Assigned Duties</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {selectedStaff
                ? `Daily operational tasks for ${selectedStaff.name}. Mark tasks complete as you finish them.`
                : 'Tasks and operational checklist appointed for team members.'}
            </p>
          </div>

          {/* Admin Appoint Button */}
          {isAdmin && (
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
            >
              <Plus size={16} /> Appoint Task
            </button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          {/* Status Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['ALL', 'PENDING', 'COMPLETED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'ALL' ? 'All Tasks' : tab === 'PENDING' ? 'Pending' : 'Completed'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority Filter */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-700">
              <Filter size={13} className="text-gray-400" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none w-44"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckSquare size={32} />
          </div>
          <h4 className="text-base font-bold text-gray-800">No To-Do Tasks Found</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Click "Appoint Task" above to assign operational duties to your salespersons and staff.'
              : 'All clear! There are currently no pending tasks assigned.'}
          </p>
          {isAdmin && (
            <button
              onClick={onOpenAddModal}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm inline-flex items-center gap-2"
            >
              <Plus size={14} /> Appoint First Task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'COMPLETED';
            const overdue = isOverdue(task.dueDate, task.status);
            const assignedStaffObj = staffList.find(s => 
              (s.id && task.assignedStaffId && String(s.id).trim() === String(task.assignedStaffId).trim()) ||
              (s.appUsername && task.assignedStaffId && String(s.appUsername).trim().toLowerCase() === String(task.assignedStaffId).trim().toLowerCase())
            );
            const staffName = task.assignedStaffId === 'ALL'
              ? 'All Staff Members'
              : (assignedStaffObj?.name || task.assignedStaffName || 'Staff');

            return (
              <div
                key={task.id}
                className={`bg-white rounded-2xl border p-4 shadow-sm transition-all flex items-start gap-3.5 group ${
                  isDone
                    ? 'border-gray-200 bg-gray-50/40 opacity-75'
                    : overdue
                    ? 'border-rose-200 ring-1 ring-rose-500/20'
                    : 'border-gray-200 hover:border-emerald-200'
                }`}
              >
                {/* Interactive Checkbox Button */}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(task)}
                  disabled={togglingId === task.id}
                  className="mt-0.5 text-gray-300 hover:text-emerald-600 focus:outline-none transition-colors shrink-0"
                  title={isDone ? 'Mark as Incomplete' : 'Mark as Completed'}
                >
                  {isDone ? (
                    <CheckCircle2 size={24} className="text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Square size={24} className="hover:stroke-emerald-600" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {getPriorityBadge(task.priority)}
                    <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                      <User size={12} className="text-gray-400" /> {staffName}
                    </span>
                    {task.dueDate && (
                      <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                        overdue ? 'text-rose-600 font-bold' : 'text-gray-500'
                      }`}>
                        <Calendar size={12} />
                        {overdue ? 'Overdue: ' : 'Due: '} {task.dueDate}
                      </span>
                    )}
                  </div>

                  <h4 className={`text-sm font-bold text-gray-900 transition-all ${
                    isDone ? 'line-through text-gray-400 font-medium' : ''
                  }`}>
                    {task.title}
                  </h4>

                  {task.description && (
                    <p className={`text-xs text-gray-500 mt-1 whitespace-pre-wrap ${
                      isDone ? 'line-through text-gray-400' : ''
                    }`}>
                      {task.description}
                    </p>
                  )}

                  {isDone && task.completedBy && (
                    <div className="mt-2 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 size={11} /> Completed by {task.completedBy}
                      {task.completedAt ? ` on ${new Date(task.completedAt).toLocaleDateString()}` : ''}
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Edit Task"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => task.id && handleDelete(task.id)}
                      disabled={deletingId === task.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffTasksView;
