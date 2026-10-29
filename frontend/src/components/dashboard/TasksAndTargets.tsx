import React, { useState, useEffect } from 'react';
import { Target, CheckSquare, Plus, RefreshCw, User, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useGlobalData } from '@/context/GlobalDataContext';
import { staffApi, StaffTarget, StaffTask, Staff } from '@/lib/api';
import StaffTargetsView from './StaffTargetsView';
import StaffTasksView from './StaffTasksView';
import StaffTargetModal from './StaffTargetModal';
import StaffTaskModal from './StaffTaskModal';

const TARGETS_CACHE_KEY = 'LINGAM_SPARES_V1_staff_targets';
const TASKS_CACHE_KEY = 'LINGAM_SPARES_V1_staff_tasks';

const getInitialCache = <T,>(key: string): T[] => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

const fetchWithTimeout = <T,>(promise: Promise<T>, ms: number = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms)),
  ]);
};

const TasksAndTargets: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isCashierRoute = location.pathname.startsWith('/cashier');
  const isAdmin = user?.role?.toLowerCase() === 'admin' && !isCashierRoute;
  const { staff: staffList = [], bills = [] } = useGlobalData() as any;

  const [activeTab, setActiveTab] = useState<'targets' | 'tasks'>('targets');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');

  const [targets, setTargets] = useState<StaffTarget[]>(() => getInitialCache<StaffTarget>(TARGETS_CACHE_KEY));
  const [tasks, setTasks] = useState<StaffTask[]>(() => getInitialCache<StaffTask>(TASKS_CACHE_KEY));
  const [loading, setLoading] = useState<boolean>(() => {
    // Only block with loading if we have zero cached items
    const hasCachedTargets = getInitialCache<StaffTarget>(TARGETS_CACHE_KEY).length > 0;
    const hasCachedTasks = getInitialCache<StaffTask>(TASKS_CACHE_KEY).length > 0;
    return !hasCachedTargets && !hasCachedTasks;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals state
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<StaffTarget | null>(null);
  const [editingTask, setEditingTask] = useState<StaffTask | null>(null);

  const fetchData = async () => {
    setIsSyncing(true);
    // If we have no cached data at all, show loading spinner
    if (targets.length === 0 && tasks.length === 0) {
      setLoading(true);
    }

    try {
      const [targetsRes, tasksRes] = await Promise.allSettled([
        fetchWithTimeout(staffApi.getAllTargets()),
        fetchWithTimeout(staffApi.getAllTasks()),
      ]);

      if (targetsRes.status === 'fulfilled' && Array.isArray(targetsRes.value?.data)) {
        setTargets(targetsRes.value.data);
        try {
          localStorage.setItem(TARGETS_CACHE_KEY, JSON.stringify(targetsRes.value.data));
        } catch {}
      }

      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value?.data)) {
        setTasks(tasksRes.value.data);
        try {
          localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasksRes.value.data));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load targets or tasks', err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedStaffObj = selectedStaffId === 'ALL'
    ? null
    : (staffList.find((s: Staff) => s.id === selectedStaffId) || null);

  const filteredTargetsCount = selectedStaffObj
    ? targets.filter(t =>
        (selectedStaffObj.id && t.staffId && String(t.staffId).trim() === String(selectedStaffObj.id).trim()) ||
        (selectedStaffObj.appUsername && t.staffId && String(t.staffId).trim().toLowerCase() === String(selectedStaffObj.appUsername).trim().toLowerCase())
      ).length
    : targets.length;

  const filteredTasksCount = selectedStaffObj
    ? tasks.filter(t =>
        (selectedStaffObj.id && t.assignedStaffId && String(t.assignedStaffId).trim() === String(selectedStaffObj.id).trim()) ||
        (selectedStaffObj.appUsername && t.assignedStaffId && String(t.assignedStaffId).trim().toLowerCase() === String(selectedStaffObj.appUsername).trim().toLowerCase()) ||
        t.assignedStaffId === 'ALL'
      ).length
    : tasks.length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-200">
              <Target size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                  Tasks & Targets
                </h1>
                {!isAdmin && (
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Shield size={12} className="text-slate-400" /> View Only
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {isAdmin
                  ? 'Sales targets achieved automatically from billed sales, and staff to-do checklists'
                  : 'View sales targets progress and staff to-do checklists (read-only)'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Staff Filter Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
            <User size={15} className="text-slate-400 mr-2" />
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer pr-2"
            >
              <option value="ALL">All Staff Members</option>
              {staffList.map((s: Staff) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading || isSyncing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1.5 text-xs font-bold"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading || isSyncing ? 'animate-spin text-blue-600' : ''} />
            {isSyncing && <span className="text-[10px] text-blue-600 font-bold hidden sm:inline">Syncing...</span>}
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setEditingTarget(null);
                  setTargetModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm shadow-blue-200 transition flex items-center gap-1.5"
              >
                <Plus size={16} />
                <span>Set Sales Target</span>
              </button>

              <button
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm shadow-emerald-200 transition flex items-center gap-1.5"
              >
                <Plus size={16} />
                <span>Assign To-Do Task</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('targets')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-sm border-b-2 transition ${
            activeTab === 'targets'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target size={18} />
          <span>Sales Targets</span>
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {filteredTargetsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-sm border-b-2 transition ${
            activeTab === 'tasks'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare size={18} />
          <span>To-Do Tasks</span>
          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {filteredTasksCount}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'targets' ? (
        <StaffTargetsView
          targets={targets}
          staffList={staffList}
          selectedStaff={selectedStaffObj}
          bills={bills}
          isAdmin={isAdmin}
          onOpenAddModal={() => {
            setEditingTarget(null);
            setTargetModalOpen(true);
          }}
          onEditTarget={(target) => {
            setEditingTarget(target);
            setTargetModalOpen(true);
          }}
          onRefresh={fetchData}
        />
      ) : (
        <StaffTasksView
          tasks={tasks}
          staffList={staffList}
          selectedStaff={selectedStaffObj}
          isAdmin={isAdmin}
          onOpenAddModal={() => {
            setEditingTask(null);
            setTaskModalOpen(true);
          }}
          onEditTask={(task) => {
            setEditingTask(task);
            setTaskModalOpen(true);
          }}
          onRefresh={fetchData}
        />
      )}

      {/* Modals for Admin Appointing */}
      <StaffTargetModal
        isOpen={targetModalOpen}
        onClose={() => {
          setTargetModalOpen(false);
          setEditingTarget(null);
        }}
        staffList={staffList}
        selectedStaffId={selectedStaffId !== 'ALL' ? selectedStaffId : undefined}
        initialTarget={editingTarget}
        onSuccess={fetchData}
      />

      <StaffTaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        staffList={staffList}
        selectedStaffId={selectedStaffId !== 'ALL' ? selectedStaffId : undefined}
        initialTask={editingTask}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default TasksAndTargets;
