import React, { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
    Plus, Search, Trash2, Edit2, User, Phone, Calendar as CalendarIcon,
    CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2,

    FileText, UploadCloud, DollarSign, Timer, Users, Briefcase, CreditCard, Shield, Activity,
    UserCheck, Save, Edit3, Target, CheckSquare, Lock, Eye, EyeOff
} from 'lucide-react';
import { staffApi, Staff, Attendance, Role, Commission, billingApi, StaffTarget, StaffTask } from '@/lib/api';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
    addMonths, subMonths, getDay, isToday, startOfWeek, endOfWeek, isSameMonth
} from 'date-fns';
import { useGlobalData } from '@/context/GlobalDataContext';
import { useCachedResource } from '@/hooks/useCachedResource';
import { SyncIndicator } from '@/components/SyncIndicator';
import StaffSalaryView from './StaffSalaryView';
import ConfirmPaymentModal from './ConfirmPaymentModal';
import StaffTargetsView from './StaffTargetsView';
import StaffTasksView from './StaffTasksView';
import StaffTargetModal from './StaffTargetModal';
import StaffTaskModal from './StaffTaskModal';

import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';

const StaffManagement = () => {
    const { user } = useAuth();
    const location = useLocation();
    const isCashierRoute = location.pathname.startsWith('/cashier');
    const isAdmin = user?.role?.toLowerCase() === 'admin' && !isCashierRoute;
    const [activeTab, setActiveTab] = useState<'directory' | 'targets' | 'tasks' | 'salary'>('directory');
    const { staff: staffList, loading: staffLoading, refreshStaff, mutateStaff, isSyncing, bills = [] } = useGlobalData();
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { confirm: confirmAction, ConfirmationDialog } = useConfirm();

    // Targets & Tasks State
    const [targets, setTargets] = useState<StaffTarget[]>([]);
    const [tasks, setTasks] = useState<StaffTask[]>([]);
    const [targetsLoading, setTargetsLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [targetModalOpen, setTargetModalOpen] = useState(false);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState<StaffTarget | null>(null);
    const [editingTask, setEditingTask] = useState<StaffTask | null>(null);
    const [modalStaffId, setModalStaffId] = useState<string>('');

    const fetchTargets = async () => {
        setTargetsLoading(true);
        try {
            const res = await staffApi.getAllTargets();
            setTargets(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to load staff targets", err);
            setTargets([]);
        } finally {
            setTargetsLoading(false);
        }
    };

    const fetchTasks = async () => {
        setTasksLoading(true);
        try {
            const res = await staffApi.getAllTasks();
            setTasks(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to load staff tasks", err);
            setTasks([]);
        } finally {
            setTasksLoading(false);
        }
    };

    useEffect(() => {
        fetchTargets();
        fetchTasks();
    }, []);

    // Reset to directory if non-admin tries to stay on salary tab
    useEffect(() => {
        if (!isAdmin && activeTab === 'salary') {
            setActiveTab('directory');
        }
    }, [isAdmin, activeTab]);


    const handleDelete = (id: string) => {
        if (!isAdmin) {
            toast.error("Only Admin can delete staff.");
            return;
        }
        confirmAction("Are you sure you want to delete this staff member?", async () => {
            setDeletingId(id);
            try {
                await staffApi.delete(id);
                toast.success("Staff deleted successfully");
                if (mutateStaff) {
                    mutateStaff((prev: Staff[]) => prev.filter(s => s.id !== id));
                }
                refreshStaff();
            } catch (error) {
                toast.error("Failed to delete staff");
            } finally {
                setDeletingId(null);
            }
        });
    };

    return (
        <div className="h-[calc(100vh-125px)] flex flex-col overflow-hidden">
            <ConfirmationDialog />
            {/* Header */}
            <div className="flex justify-between items-center mb-3.5 flex-shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2.5">
                        <Users className="text-blue-600" size={22} />
                        <span>Staff Management</span>
                        {!isAdmin && (
                            <span className="text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Shield size={12} className="text-slate-400" /> View Only
                            </span>
                        )}
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {isAdmin
                            ? 'Manage employees, track attendance, and process payroll'
                            : 'View employee profiles, bank details, attendance history, and targets (read-only)'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <SyncIndicator isSyncing={isSyncing} />
                    <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-2xs border border-gray-200">
                        <TabButton active={activeTab === 'directory'} onClick={() => setActiveTab('directory')} icon={Briefcase} label="Directory" />
                        <TabButton active={activeTab === 'targets'} onClick={() => setActiveTab('targets')} icon={Target} label="Targets" />
                        <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={CheckSquare} label="To-Do Tasks" />
                        {isAdmin && (
                            <TabButton active={activeTab === 'salary'} onClick={() => setActiveTab('salary')} icon={DollarSign} label="Payroll" />
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'directory' ? (
                <div className="flex-1 min-h-0 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <DirectoryView
                        staff={staffList}
                        loading={staffLoading}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        onRefresh={refreshStaff}
                        mutateStaff={mutateStaff}
                        onDelete={handleDelete}
                        deletingId={deletingId}
                        confirmAction={confirmAction}
                        isAdmin={isAdmin}
                        targets={targets}
                        tasks={tasks}
                        bills={bills}
                        onOpenAddTarget={(staffId?: string) => { setModalStaffId(staffId || ''); setEditingTarget(null); setTargetModalOpen(true); }}
                        onEditTarget={(t: any) => { setEditingTarget(t); setTargetModalOpen(true); }}
                        onOpenAddTask={(staffId?: string) => { setModalStaffId(staffId || ''); setEditingTask(null); setTaskModalOpen(true); }}
                        onEditTask={(t: any) => { setEditingTask(t); setTaskModalOpen(true); }}
                        onRefreshTargets={fetchTargets}
                        onRefreshTasks={fetchTasks}
                    />
                </div>
            ) : (
                <div className="flex-1 overflow-auto bg-white rounded-xl shadow-xs border border-gray-200 p-4 relative">
                    {activeTab === 'targets' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
                            <StaffTargetsView
                                targets={targets}
                                staffList={staffList}
                                selectedStaff={null}
                                bills={bills}
                                isAdmin={isAdmin}
                                onOpenAddModal={() => { setEditingTarget(null); setTargetModalOpen(true); }}
                                onEditTarget={(t) => { setEditingTarget(t); setTargetModalOpen(true); }}
                                onRefresh={fetchTargets}
                            />
                        </div>
                    )}
                    {activeTab === 'tasks' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
                            <StaffTasksView
                                tasks={tasks}
                                staffList={staffList}
                                selectedStaff={null}
                                isAdmin={isAdmin}
                                onOpenAddModal={() => { setEditingTask(null); setTaskModalOpen(true); }}
                                onEditTask={(t) => { setEditingTask(t); setTaskModalOpen(true); }}
                                onRefresh={fetchTasks}
                            />
                        </div>
                    )}
                    {isAdmin && activeTab === 'salary' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
                            <StaffSalaryView />
                        </div>
                    )}
                </div>
            )}

            {/* Target Modal (Admin Only) */}
            <StaffTargetModal
                isOpen={targetModalOpen}
                onClose={() => { setTargetModalOpen(false); setEditingTarget(null); setModalStaffId(''); }}
                staffList={staffList}
                selectedStaffId={modalStaffId || undefined}
                initialTarget={editingTarget}
                onSuccess={fetchTargets}
            />

            {/* Task Modal (Admin Only) */}
            <StaffTaskModal
                isOpen={taskModalOpen}
                onClose={() => { setTaskModalOpen(false); setEditingTask(null); setModalStaffId(''); }}
                staffList={staffList}
                selectedStaffId={modalStaffId || undefined}
                initialTask={editingTask}
                onSuccess={fetchTasks}
            />
        </div>
    );
};


const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${active
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
    >
        <Icon size={14} />
        <span>{label}</span>
    </button>
);

// --- MARK ATTENDANCE MODAL ---
const MarkAttendanceDialog = ({ staff, date, currentStatus, onClose, onSuccess }: any) => {
    const [status, setStatus] = useState(currentStatus || 'PRESENT');
    const [remarks, setRemarks] = useState('');

    // Permission Time State
    const [startTime, setStartTime] = useState("10:00");
    const [endTime, setEndTime] = useState("12:00");
    const [permHrs, setPermHrs] = useState(0);

    useEffect(() => {
        if (startTime && endTime) {
            const [h1, m1] = startTime.split(':').map(Number);
            const [h2, m2] = endTime.split(':').map(Number);
            const totalStartMinutes = h1 * 60 + m1;
            const totalEndMinutes = h2 * 60 + m2;
            const diffInMinutes = totalEndMinutes - totalStartMinutes;
            if (diffInMinutes > 0) {
                const h = Math.floor(diffInMinutes / 60);
                const m = diffInMinutes % 60;
                setPermHrs(Number(`${h}.${m.toString().padStart(2, '0')}`));
            } else {
                setPermHrs(0);
            }
        }
    }, [startTime, endTime]);

    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const payload: any = {
                staffId: staff.id,
                staffName: staff.name,
                date: date,
                status: status,
                remarks: remarks,
                permissionTimeRange: status === 'PERMISSION' ? `${startTime} - ${endTime}` : undefined,
                permissionHours: status === 'PERMISSION' ? permHrs : 0,
                inTime: status === 'PRESENT' ? new Date().toLocaleTimeString('en-US', { hour12: false }) : "-",
                outTime: "-"
            };
            await staffApi.markAttendance(payload);
            toast.success("Attendance marked");
            onSuccess();
            onClose();
        } catch (e) {
            toast.error("Failed to mark attendance");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <UserCheck size={24} />
                        Mark Attendance
                    </h3>
                    <p className="text-blue-100 text-sm opacity-90">{staff.name}</p>
                </div>

                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <Activity size={12} /> Status
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {['PRESENT', 'ABSENT', 'HALF_DAY', 'PERMISSION', 'LEAVE', 'SICK_LEAVE'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s)}
                                    className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${status === s
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.02]'
                                        : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-blue-200'}`}
                                >
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {status === 'PERMISSION' && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 fill-mode-both">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Start Time</label>
                                    <TimePicker value={startTime} onChange={setStartTime} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider">End Time</label>
                                    <TimePicker value={endTime} onChange={setEndTime} />
                                </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:scale-110 transition-transform">
                                    <Clock size={48} />
                                </div>
                                <div className="text-xs text-blue-600 font-black uppercase tracking-widest mb-1">Total Duration</div>
                                <div className="text-3xl font-black text-blue-800 tabular-nums">{String(permHrs)} <span className="text-lg opacity-60">hrs</span></div>
                            </div>
                        </div>
                    )}



                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">Cancel</button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-black hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- DIRECTORY VIEW (Split Pane Layout) ---
const DirectoryView = ({
    staff, loading, searchTerm, setSearchTerm, onRefresh, mutateStaff, onDelete, deletingId, confirmAction, isAdmin,
    targets = [], tasks = [], bills = [], onOpenAddTarget, onEditTarget, onOpenAddTask, onEditTask, onRefreshTargets, onRefreshTasks
}: any) => {
    const [staffSubTab, setStaffSubTab] = useState<'attendance' | 'targets' | 'tasks'>('attendance');
    const [showModal, setShowModal] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Local staff list for instantaneous zero-lag UI updates on add & edit
    const [localStaffList, setLocalStaffList] = useState<Staff[]>(Array.isArray(staff) ? staff : []);

    useEffect(() => {
        if (Array.isArray(staff)) {
            setLocalStaffList(staff);
        }
    }, [staff]);

    // Keep selectedStaff up-to-date with any edits in localStaffList
    useEffect(() => {
        if (!selectedStaff && localStaffList.length > 0) {
            setSelectedStaff(localStaffList[0]);
        } else if (selectedStaff && localStaffList.length > 0) {
            const fresh = localStaffList.find((s: Staff) => s.id === selectedStaff.id);
            if (fresh) {
                if (
                    fresh.appUsername !== selectedStaff.appUsername ||
                    fresh.appPassword !== selectedStaff.appPassword ||
                    fresh.name !== selectedStaff.name ||
                    fresh.phone !== selectedStaff.phone ||
                    fresh.role !== selectedStaff.role
                ) {
                    setSelectedStaff(fresh);
                }
            }
        }
    }, [localStaffList]);


    // Payment Modal State
    const [paymentModalReq, setPaymentModalReq] = useState<{ isOpen: boolean; commission: any | null }>({ isOpen: false, commission: null });

    // Manual marking state
    const [markingStaff, setMarkingStaff] = useState<Staff | null>(null);
    const [markingStatus, setMarkingStatus] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- ATTENDANCE LOGIC (Global for List Status) ---
    const { data: attendanceData, refresh: refreshAttendance } = useCachedResource<any[]>(
        `daily_attendance_${date}`,
        async () => {
            const res = await staffApi.getDailyAttendance(date);
            const data = res.data;
            let list: any[] = [];
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                list = Object.entries(data).map(([staffId, details]: any) => ({
                    staffId, staffName: details.name, date,
                    status: details.status || details.type,
                    remarks: details.remarks,
                    permissionTimeRange: details.permissionTimeRange || details.permissionTime
                }));
            } else if (Array.isArray(data)) {
                list = data.map((item: any) => ({
                    ...item,
                    status: item.status || item.type,
                    permissionTimeRange: item.permissionTimeRange || item.permissionTime
                }));
            }
            return list;
        },
        { ttl: 0 } // No cache for live actions
    );

    const attendanceMap = useMemo(() => {
        const map: Record<string, any> = {};
        if (Array.isArray(attendanceData)) {
            attendanceData.forEach(a => map[a.staffId] = a);
        }
        return map;
    }, [attendanceData]);

    const handleMarkClick = (staffObj: Staff, status: string) => {
        if (!isAdmin) {
            toast.error("Only Admin can mark staff attendance.");
            return;
        }
        // Quick mark for PRESENT, ABSENT, and HALF_DAY
        if (status === 'PRESENT' || status === 'ABSENT' || status === 'HALF_DAY') {
            const payload: any = {
                staffId: staffObj.id,
                staffName: staffObj.name,
                date: date,
                status: status,
                inTime: status === 'PRESENT' ? new Date().toLocaleTimeString('en-US', { hour12: false }) : "-",
                outTime: "-"
            };
            staffApi.markAttendance(payload).then(() => {
                toast.success(`Marked ${status}`);
                refreshAttendance();
                // Refresh specific staff history if selected
                if (selectedStaff?.id === staffObj.id) {
                    refreshHistory();
                }
            }).catch(() => toast.error('Failed'));
        } else {
            setMarkingStaff(staffObj);
            setMarkingStatus(status);
        }
    };

    // --- SELECTED STAFF HISTORY & INCENTIVE ---
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [incentive, setIncentive] = useState(0);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [commissionsLoading, setCommissionsLoading] = useState(false);


    const fetchHistory = async (id: string) => {
        setHistoryLoading(true);
        try {
            const currentMonth = format(new Date(), 'yyyy-MM');

            // 1. Fetch Attendance History
            const res = await staffApi.getStaffMonthAttendance(id, currentMonth);
            const data = res.data;
            let list: any[] = [];
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                list = Object.entries(data).map(([key, val]: any) => ({
                    ...val,
                    date: `${currentMonth}-${key.padStart(2, '0')}`,
                    status: val.status || val.type
                }));
            } else if (Array.isArray(data)) {
                list = data;
            }
            list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setHistory(list);

            /* // 2. Fetch Incentive - MOVED TO fetchCommissions to ensure consistency with ledger
            try {
                const slipRes = await staffApi.getSalarySlip(id, currentMonth);
                setIncentive(slipRes.data?.commissionEarnings || 0);
            } catch (err) {
                setIncentive(0);
            } */
            // Reset to 0 initially, will be set by fetchCommissions
            setIncentive(0);
            setPendingTotal(0);

        } catch (e) {
            console.error("Failed to load history", e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const refreshHistory = () => {
        if (selectedStaff) {
            fetchHistory(selectedStaff.id);
            fetchCommissions(selectedStaff.id, selectedStaff.name);
        }
    };

    const handleStatusToggle = async (comm: any) => {
        if (!isAdmin) {
            toast.error("Only Admin can update commission payment status.");
            return;
        }
        if (!comm || !comm.id) return;
        const newStatus = comm.status === 'PAID' ? 'UNPAID' : 'PAID';

        if (newStatus === 'PAID') {
            setPaymentModalReq({ isOpen: true, commission: comm });
            return;
        }

        confirmAction(`Mark ${comm.billId || 'commission'} as ${newStatus}?`, async () => {
            try {
                // Logic for reverting to UNPAID
                if (comm.source === 'BILL') {
                    // Update the Bill directly for legacy/bill-embedded support
                    await billingApi.update(comm.id, { staffCommissionStatus: newStatus } as any);
                } else {
                    // If there's no endpoint to unpay, warn the user
                    toast.error("Cannot revert this commission to UNPAID via this interface.");
                    return;
                }

                toast.success(`Marked as ${newStatus}`);
                // Refresh
                if (selectedStaff) fetchCommissions(selectedStaff.id, selectedStaff.name);
            } catch (err) {
                console.error("Failed to update status", err);
                toast.error("Failed to update status. " + (err instanceof Error ? err.message : ""));
            }
        });
    };

    const handlePaymentConfirm = async (paymentMethod: string) => {
        if (!isAdmin) {
            toast.error("Only Admin can confirm commission payments.");
            return;
        }
        const comm = paymentModalReq.commission;
        if (!comm || !comm.id) return;
        try {
            await staffApi.payCommission(comm.id, paymentMethod);
            toast.success(`Marked as PAID via ${paymentMethod}`);
            if (selectedStaff) fetchCommissions(selectedStaff.id, selectedStaff.name);
            setPaymentModalReq({ isOpen: false, commission: null });
        } catch (err) {
            console.error("Failed to mark as paid", err);
            toast.error("Failed to mark as paid.");
        }
    };

    const fetchCommissions = async (id: string, name?: string) => {
        setCommissionsLoading(true);
        try {
            // Use current month by default or add a month selector if needed.
            // For now, defaulting to current month as per usual "Ledger" view for a specific period
            // OR if the user intends "Ledger" to be all-time, we might need a different approach,
            // but the request specifically asked for `?yearMonth=2026-01`.
            // Let's use the current month since the UI shows "This Month" incentives.
            const currentYearMonth = format(new Date(), 'yyyy-MM');

            const commRes = await staffApi.getStaffCommissions(id, currentYearMonth);
            // The backend returns List<Map<String, Object>>, which matches our Commission interface roughly
            // but might need mapping if keys differ. Assuming standard keys as per typical Spring Boot -> JSON.

            const fetchedCommissions = Array.isArray(commRes.data) ? commRes.data : [];

            // Sort by date desc
            fetchedCommissions.sort((a: any, b: any) => {
                const dA = a.date ? new Date(a.date).getTime() : 0;
                const dB = b.date ? new Date(b.date).getTime() : 0;
                return dB - dA;
            });

            setCommissions(fetchedCommissions as any[]);

            // Calculate Incentive for Current Month (which IS the returned data now)
            const monthlyTotal = fetchedCommissions
                .reduce((sum: number, c: any) => {
                    // Backend likely returns 'amount' or 'staffCommissionAmount'
                    const val = Number(c.amount) || Number(c.staffCommissionAmount) || 0;
                    return sum + val;
                }, 0);

            setIncentive(monthlyTotal);

            // Calculate Pending Total (All Time Unpaid)
            const pending = fetchedCommissions
                .filter((c: any) => c.status === 'UNPAID')
                .reduce((sum: number, c: any) => {
                    const val = Number(c.amount) || Number(c.staffCommissionAmount) || 0;
                    return sum + val;
                }, 0);
            setPendingTotal(pending);

        } catch (error) {
            console.error("Failed to fetch commissions", error);
            setCommissions([]);
            setIncentive(0);
            setPendingTotal(0);
        } finally {
            setCommissionsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedStaff) {
            fetchHistory(selectedStaff.id);
            fetchCommissions(selectedStaff.id, selectedStaff.name);
        } else {
            setHistory([]);
            setCommissions([]);
        }
    }, [selectedStaff]);

    const filteredCommissions = commissions.filter(c => {
        if (!c.date) return true;
        const commDate = new Date(c.date);
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (commDate < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (commDate > end) return false;
        }
        return true;
    });


    // --- FILTERING ---
    const filteredStaff = localStaffList.filter((s: Staff) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone.includes(searchTerm) ||
        (s.appUsername && s.appUsername.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Derived Stats
    const getStats = () => {
        const present = history.filter(h => h.status === 'PRESENT' || h.status === 'FULL_DAY').length;
        const absent = history.filter(h => h.status === 'ABSENT').length;
        const perms = history.filter(h => h.status === 'PERMISSION').length;
        return { present, absent, perms };
    };
    const stats = getStats();

    return (
        <div className="flex h-full gap-4 min-h-0 overflow-hidden">
            <ConfirmPaymentModal
                isOpen={paymentModalReq.isOpen}
                onClose={() => setPaymentModalReq({ isOpen: false, commission: null })}
                onConfirm={handlePaymentConfirm}
                message={`Mark ${paymentModalReq.commission?.billId || 'commission'} as PAID?`}
            />
            {/* Left Panel: List */}
            <div className="w-80 lg:w-84 xl:w-92 shrink-0 bg-white rounded-xl shadow-xs flex flex-col border border-gray-200 overflow-hidden">
                <div className="p-3.5 border-b bg-gray-50/70">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 truncate">
                                <Users className="text-blue-600 shrink-0" size={17} />
                                <span>Staff Directory</span>
                            </h2>
                            <span className="text-[11px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                {filteredStaff.length}
                            </span>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => { setEditingStaff(null); setShowModal(true); }}
                                className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 shadow-xs transition-all flex items-center gap-1 text-xs font-semibold shrink-0 active:scale-95"
                                title="Add Staff"
                            >
                                <Plus size={14} /> Add Staff
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search Name, Phone, Role..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-xs"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-grow custom-scrollbar">
                    {loading && staff.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-xs"><Loader2 className="animate-spin mx-auto mb-2" size={18} /> Loading staff...</div>
                    ) : filteredStaff.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-xs">No staff found.</div>
                    ) : (
                        filteredStaff.map(s => {
                            const record = attendanceMap[s.id];
                            const statusColor = record?.status === 'PRESENT' ? 'bg-green-500' :
                                record?.status === 'ABSENT' ? 'bg-red-500' :
                                    record?.status === 'permission' || record?.status === 'PERMISSION' ? 'bg-blue-500' : 'bg-gray-300';
                            const isSelected = selectedStaff?.id === s.id;
                            return (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedStaff(s)}
                                    className={`p-2.5 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 flex items-center justify-between gap-2.5 relative ${
                                        isSelected ? 'bg-blue-50/70 border-l-3 border-l-blue-600' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="relative shrink-0">
                                            {s.profilePicUrl ? (
                                                <img src={s.profilePicUrl} alt={s.name} className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
                                            ) : (
                                                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs">
                                                    {s.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusColor}`}></div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-gray-900 truncate text-xs">{s.name}</div>
                                            <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                {s.phone ? (
                                                    <span className="flex items-center gap-1"><Phone size={10} className="text-gray-400" /> {s.phone}</span>
                                                ) : (
                                                    <span className="italic text-gray-400">No phone</span>
                                                )}
                                                <span>•</span>
                                                <span className="text-gray-600 font-medium truncate">{s.role}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedStaff(s);
                                                    setEditingStaff(s);
                                                    setShowModal(true);
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit Staff & Login Details"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                        )}
                                        {isSelected && <ChevronRight size={15} className="text-blue-500" />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel: Details */}
            <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar h-full pr-1">
                {selectedStaff ? (
                    <>
                        {/* 1. Header & Details Card */}
                        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-3.5 shrink-0">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    {selectedStaff.profilePicUrl ? (
                                        <img src={selectedStaff.profilePicUrl} alt={selectedStaff.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-2xs shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                                            {selectedStaff.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg font-bold text-gray-800 truncate">
                                                {selectedStaff.name}
                                            </h2>
                                            <span className="bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                                {selectedStaff.role}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            Staff ID: <span className="font-mono font-medium text-gray-700">{selectedStaff.id.substring(0, 8)}</span>
                                        </div>
                                    </div>
                                </div>
                                {isAdmin ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => { setEditingStaff(selectedStaff); setShowModal(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95"
                                            title="Edit Staff"
                                        >
                                            <Edit2 size={13} />
                                            <span>Edit Staff</span>
                                        </button>
                                        <button
                                            onClick={() => onDelete(selectedStaff.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Staff"
                                        >
                                            {deletingId === selectedStaff.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 shrink-0">
                                        <Shield size={12} className="text-slate-400" />
                                        <span>View Only</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2.5 border-t border-gray-100">
                                <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Phone size={12} /></div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone</div>
                                        <div className="font-semibold text-gray-800 text-xs font-mono truncate">{selectedStaff.phone || 'N/A'}</div>
                                        {selectedStaff.emergencyPhone && (
                                            <div className="text-[10px] text-red-500 font-medium truncate">Emg: {selectedStaff.emergencyPhone}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Briefcase size={12} /></div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Designation</div>
                                        <div className="font-semibold text-gray-800 text-xs truncate">{selectedStaff.role || 'Staff'}</div>
                                    </div>
                                </div>
                                <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><CreditCard size={12} /></div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Details</div>
                                        <div className="font-medium text-gray-800 text-xs font-mono truncate">
                                            <span className="text-gray-400 font-sans text-[10px] mr-1">A/C:</span>
                                            {isAdmin ? (selectedStaff.accountNumber || 'N/A') : (selectedStaff.accountNumber ? '••••••••' + selectedStaff.accountNumber.slice(-4) : 'N/A')}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono truncate">
                                            <span className="text-gray-400 font-sans text-[10px] mr-1">IFSC:</span>
                                            {isAdmin ? (selectedStaff.ifscCode || 'N/A') : (selectedStaff.ifscCode ? '••••' + selectedStaff.ifscCode.slice(-4) : 'N/A')}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Clock size={12} /></div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Permitted Time</div>
                                        <div className="font-semibold text-gray-800 text-xs">{selectedStaff.allowedPermHours || 0} hrs / mo</div>
                                        <div className="text-[10px] text-gray-400 truncate">Monthly allowance</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Stats Cards */}
                        <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5 shrink-0`}>
                            {isAdmin && (
                                <div className="bg-white p-2.5 rounded-xl shadow-2xs border border-gray-200 border-l-3 border-l-blue-500">
                                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Monthly Base Salary</div>
                                    <div className="text-base font-bold text-blue-700 font-mono mt-0.5">₹{(selectedStaff.baseSalary || 0).toLocaleString()}</div>
                                    <div className="text-[10px] text-gray-400">Fixed compensation</div>
                                </div>
                            )}
                            <div className="bg-white p-2.5 rounded-xl shadow-2xs border border-gray-200 border-l-3 border-l-emerald-500">
                                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">This Month Incentives</div>
                                <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">₹{incentive.toLocaleString()}</div>
                                <div className="text-[10px] text-gray-400">Live sales commission</div>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl shadow-2xs border border-gray-200 border-l-3 border-l-amber-500">
                                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Pending Payout</div>
                                <div className="text-base font-bold text-amber-600 font-mono mt-0.5">₹{pendingTotal.toLocaleString()}</div>
                                <div className="text-[10px] text-gray-400">Unsettled commission balance</div>
                            </div>
                        </div>

                        {/* 3. Sub-tabs for Selected Staff */}
                        <div className="flex items-center gap-1.5 bg-gray-100/90 p-1 rounded-lg self-start shrink-0 border border-gray-200/60">
                            <button
                                onClick={() => setStaffSubTab('attendance')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    staffSubTab === 'attendance' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <CalendarIcon size={13} /> Attendance & Commissions
                            </button>
                            <button
                                onClick={() => setStaffSubTab('targets')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    staffSubTab === 'targets' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Target size={13} className="text-blue-500" /> Sales Targets
                            </button>
                            <button
                                onClick={() => setStaffSubTab('tasks')}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    staffSubTab === 'tasks' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <CheckSquare size={13} className="text-emerald-500" /> To-Do Tasks
                            </button>
                        </div>

                        {staffSubTab === 'attendance' && (
                            <>
                                {/* Today's Attendance Marking & Monthly Summary */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 shrink-0">
                                    {/* Action Card */}
                                    <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-gray-200 p-3.5 flex flex-col justify-between">
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                                                    <Clock size={15} className="text-blue-600" /> Daily Attendance Marking
                                                </h3>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Mark attendance status for this date</p>
                                            </div>
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { type: 'PRESENT', label: 'Present', color: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' },
                                                { type: 'ABSENT', label: 'Absent', color: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200' },
                                                { type: 'HALF_DAY', label: 'Half Day', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200' },
                                                { type: 'PERMISSION', label: 'Permit', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200' },
                                            ].map(opt => {
                                                const record = attendanceMap[selectedStaff.id];
                                                const isActive = record?.status === opt.type || (opt.type === 'PRESENT' && record?.status === 'FULL_DAY');
                                                return (
                                                    <button
                                                        key={opt.type}
                                                        onClick={() => isAdmin && handleMarkClick(selectedStaff, opt.type)}
                                                        disabled={!isAdmin}
                                                        className={`py-2 px-1.5 rounded-lg font-semibold text-xs border transition-all text-center ${
                                                            isActive ? 'ring-2 ring-offset-1 ring-blue-500 shadow-2xs bg-white' : ''
                                                        } ${opt.color} ${!isAdmin ? 'cursor-not-allowed opacity-75' : ''}`}
                                                        title={!isAdmin ? "Only Admin can mark staff attendance" : opt.label}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {attendanceMap[selectedStaff.id] && (
                                            <div className="mt-2.5 text-xs text-center text-gray-600 bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-100 flex items-center justify-center gap-3">
                                                <span>Status: <strong className="text-gray-900">{attendanceMap[selectedStaff.id].status}</strong></span>
                                                {attendanceMap[selectedStaff.id].inTime && <span>• In: <strong className="text-gray-900">{attendanceMap[selectedStaff.id].inTime}</strong></span>}
                                                {attendanceMap[selectedStaff.id].remarks && <span>• Note: <em>{attendanceMap[selectedStaff.id].remarks}</em></span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Monthly Summary Card */}
                                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-xs p-3.5 text-white flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10"><Activity size={50} /></div>
                                        <div>
                                            <h4 className="text-blue-100 text-[10px] font-bold uppercase tracking-wider mb-2">{format(new Date(), 'MMMM')} Summary</h4>
                                            <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                                                <div className="bg-white/10 rounded-lg py-2 px-1 backdrop-blur-xs">
                                                    <div className="text-lg font-bold">{stats.present}</div>
                                                    <div className="text-blue-200 text-[10px] font-medium mt-0.5">Present</div>
                                                </div>
                                                <div className="bg-white/10 rounded-lg py-2 px-1 backdrop-blur-xs">
                                                    <div className="text-lg font-bold text-red-200">{stats.absent}</div>
                                                    <div className="text-blue-200 text-[10px] font-medium mt-0.5">Absent</div>
                                                </div>
                                                <div className="bg-white/10 rounded-lg py-2 px-1 backdrop-blur-xs">
                                                    <div className="text-lg font-bold text-amber-200">{stats.perms}</div>
                                                    <div className="text-blue-200 text-[10px] font-medium mt-0.5">Permits</div>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setShowCalendarModal(true); }}
                                            className="mt-2.5 w-full py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <CalendarIcon size={13} /> View Full Calendar
                                        </button>
                                    </div>
                                </div>

                                {/* Commission Ledger Card (Matching Purchase History in Customers) */}
                                <div className="bg-white rounded-xl shadow-xs border border-gray-200 flex flex-col min-h-[300px] overflow-hidden">
                                    <div className="px-3.5 py-2 border-b bg-gray-50 flex justify-between items-center gap-4">
                                        <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 whitespace-nowrap">
                                            <CreditCard size={15} className="text-blue-600" /> Commission Ledger
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-white px-2 py-0.5">
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="text-[11px] outline-none bg-transparent"
                                                />
                                                <span className="text-gray-400 text-[11px]">to</span>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="text-[11px] outline-none bg-transparent"
                                                />
                                            </div>
                                            {(startDate || endDate) && (
                                                <button
                                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                                    className="text-xs text-red-500 hover:text-red-700 font-semibold px-1.5 py-0.5"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-50/70 border-b border-gray-100">
                                                <tr>
                                                    <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Date</th>
                                                    <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider">Bill ID</th>
                                                    <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider text-right">Amount</th>
                                                    <th className="py-2 px-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wider text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {commissionsLoading ? (
                                                    <tr><td colSpan={4} className="py-6 text-center text-gray-400 text-xs"><Loader2 className="animate-spin mx-auto mb-1.5" size={16} /> Loading ledger...</td></tr>
                                                ) : filteredCommissions.length === 0 ? (
                                                    <tr><td colSpan={4} className="py-6 text-center text-gray-400 text-xs">No commission history found.</td></tr>
                                                ) : (
                                                    filteredCommissions.map((comm) => (
                                                        <tr key={comm.id} className="hover:bg-gray-50/80 transition-colors">
                                                            <td className="py-2 px-3 text-xs font-medium text-gray-900">
                                                                {new Date(comm.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                <span className="text-[10px] text-gray-400 ml-1.5">{new Date(comm.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </td>
                                                            <td className="py-2 px-3 text-xs font-mono text-blue-600 font-medium">{comm.billId}</td>
                                                            <td className="py-2 px-3 text-xs font-bold text-right text-gray-900 font-mono">₹{(Number(comm.amount) || 0).toFixed(2)}</td>
                                                            <td className="py-2 px-3 text-center">
                                                                <button
                                                                    onClick={() => isAdmin && handleStatusToggle(comm)}
                                                                    disabled={!isAdmin}
                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                                                        isAdmin ? 'cursor-pointer active:scale-95 shadow-2xs' : 'cursor-default opacity-85'
                                                                    } ${
                                                                        comm.status === 'PAID' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                                                    }`}
                                                                    title={isAdmin ? "Click to toggle status" : "Only Admin can manage commission status"}
                                                                >
                                                                    {comm.status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                                                    {comm.status}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            {/* Footer Summaries */}
                                            {!commissionsLoading && filteredCommissions.length > 0 && (
                                                <tfoot className="bg-gray-50/80 font-bold text-xs border-t border-gray-200">
                                                    <tr>
                                                        <td colSpan={2} className="py-2 px-3 text-right text-gray-600 text-[11px]">Total Pending:</td>
                                                        <td className="py-2 px-3 text-right text-orange-600 font-bold font-mono">
                                                            ₹{(filteredCommissions.filter(c => c.status === 'UNPAID').reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || 0).toFixed(2)}
                                                        </td>
                                                        <td className="py-2 px-3"></td>
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={2} className="py-2 px-3 text-right border-t border-gray-100 text-gray-600 text-[11px]">Total Paid:</td>
                                                        <td className="py-2 px-3 text-right text-green-600 border-t border-gray-100 font-bold font-mono">
                                                            ₹{(filteredCommissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || 0).toFixed(2)}
                                                        </td>
                                                        <td className="py-2 px-3 border-t border-gray-100"></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {staffSubTab === 'targets' && (
                            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
                                <StaffTargetsView
                                    targets={targets}
                                    staffList={staff}
                                    selectedStaff={selectedStaff}
                                    bills={bills}
                                    isAdmin={isAdmin}
                                    onOpenAddModal={() => onOpenAddTarget(selectedStaff.id)}
                                    onEditTarget={onEditTarget}
                                    onRefresh={onRefreshTargets}
                                />
                            </div>
                        )}

                        {staffSubTab === 'tasks' && (
                            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
                                <StaffTasksView
                                    tasks={tasks}
                                    staffList={staff}
                                    selectedStaff={selectedStaff}
                                    isAdmin={isAdmin}
                                    onOpenAddModal={() => onOpenAddTask(selectedStaff.id)}
                                    onEditTask={onEditTask}
                                    onRefresh={onRefreshTasks}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3 shadow-2xs">
                            <Users size={24} />
                        </div>
                        <h3 className="text-base font-bold text-gray-800">No Staff Selected</h3>
                        <p className="text-gray-400 text-xs max-w-sm mt-1">
                            Choose an employee from the directory on the left to view profile details, track attendance, and process payroll.
                        </p>
                    </div>
                )}
            </div>

            {markingStaff && (
                <MarkAttendanceDialog
                    staff={markingStaff}
                    date={date}
                    currentStatus={markingStatus}
                    onClose={() => setMarkingStaff(null)}
                    onSuccess={() => { setMarkingStaff(null); refreshAttendance(); refreshHistory(); }}
                />
            )}

            {showModal && (
                <StaffFormModal
                    staff={editingStaff}
                    onClose={() => setShowModal(false)}
                    onSuccess={(savedStaff?: any) => {
                        setShowModal(false);
                        if (savedStaff) {
                            // 1. Immediately update localStaffList
                            setLocalStaffList((prev: Staff[]) => {
                                const exists = prev.some(s => s.id === savedStaff.id);
                                if (exists) {
                                    return prev.map(s => s.id === savedStaff.id ? { ...s, ...savedStaff } : s);
                                } else {
                                    return [savedStaff, ...prev];
                                }
                            });

                            // 2. Immediately update GlobalDataContext via mutateStaff
                            if (mutateStaff) {
                                mutateStaff((prev: Staff[]) => {
                                    const exists = prev.some(s => s.id === savedStaff.id);
                                    if (exists) {
                                        return prev.map(s => s.id === savedStaff.id ? { ...s, ...savedStaff } : s);
                                    } else {
                                        return [savedStaff, ...prev];
                                    }
                                });
                            }

                            // 3. Immediately update selectedStaff & editingStaff with new values
                            setSelectedStaff(savedStaff);
                            setEditingStaff(savedStaff);

                            // 4. Update cashier_staff_cache immediately
                            try {
                                const currentCached = JSON.parse(localStorage.getItem('cashier_staff_cache') || '[]');
                                const exists = currentCached.some((s: any) => s.id === savedStaff.id);
                                const updatedCache = exists
                                    ? currentCached.map((s: any) => s.id === savedStaff.id ? { ...s, ...savedStaff } : s)
                                    : [savedStaff, ...currentCached];
                                localStorage.setItem('cashier_staff_cache', JSON.stringify(updatedCache));
                            } catch {}
                        }
                        // 5. Background sync
                        if (onRefresh) onRefresh();
                    }}
                    isAdmin={isAdmin}
                />
            )}

            {showCalendarModal && selectedStaff && (
                <StaffCalendarModal
                    staff={selectedStaff}
                    onClose={() => setShowCalendarModal(false)}
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
};

const CheckingIcon = () => <Clock size={20} className="text-gray-500" />;

// --- CALENDAR MODAL (Fullscreen & Compact No-Scroll) ---
const StaffCalendarModal = ({ staff, onClose, isAdmin }: { staff: Staff, onClose: () => void, isAdmin?: boolean }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentDate]);

    const year = format(currentDate, 'yyyy');
    const month = format(currentDate, 'MM');

    // Calculate grid rows dynamically for equal height
    // Typically 5 or 6 rows
    const weekCount = Math.ceil(calendarDays.length / 7);

    // States for editing
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [remarksInput, setRemarksInput] = useState("");
    const [statusInput, setStatusInput] = useState<string>("PRESENT");

    // Calendar Permission State
    const [permStartTime, setPermStartTime] = useState("10:00");
    const [permEndTime, setPermEndTime] = useState("12:00");
    const [calPermHrs, setCalPermHrs] = useState(0);

    useEffect(() => {
        if (permStartTime && permEndTime) {
            const [h1, m1] = permStartTime.split(':').map(Number);
            const [h2, m2] = permEndTime.split(':').map(Number);
            const totalStartMinutes = h1 * 60 + m1;
            const totalEndMinutes = h2 * 60 + m2;
            const diffInMinutes = totalEndMinutes - totalStartMinutes;
            if (diffInMinutes > 0) {
                const h = Math.floor(diffInMinutes / 60);
                const m = diffInMinutes % 60;
                setCalPermHrs(Number(`${h}.${m.toString().padStart(2, '0')}`));
            } else {
                setCalPermHrs(0);
            }
        }
    }, [permStartTime, permEndTime]);

    const { data: monthData, refresh: refreshMonthData } = useCachedResource<any[]>(
        `month_attendance_${year}_${month}_${staff.id}`,
        async () => {
            // Backend returns list of daily records
            const res = await staffApi.getStaffMonthAttendance(staff.id, `${year}-${month}`);
            const data = res.data;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                return Object.entries(data).map(([key, val]: any) => ({ ...val, date: `${year}-${month}-${key.padStart(2, '0')}` }));
            }
            return Array.isArray(data) ? data : [];
        },
        { ttl: 0 }
    );

    const dataMap = useMemo(() => {
        const map: Record<string, any> = {};
        if (monthData) {
            monthData.forEach((r: any) => {
                let dKey = r.date;
                if (!dKey && r.day) dKey = `${year}-${month}-${r.day.toString().padStart(2, '0')}`;

                // Prioritize status from various fields
                const st = r.status || r.type || r.data?.status;
                const remarks = r.remarks || r.data?.remarks || r.comment || r.notes;
                const permissionTimeRange = r.permissionTimeRange || r.permissionTime || r.data?.permissionTimeRange;

                if (dKey) {
                    map[dKey] = { ...r, status: st, remarks, permissionTimeRange };
                }
            });
        }
        return map;
    }, [monthData, year, month]);

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'PRESENT': case 'FULL_DAY': return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
            case 'ABSENT': return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
            case 'HALF_DAY': return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100';
            case 'LEAVE': case 'SICK_LEAVE': return 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100';
            case 'PERMISSION': return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
            default: return 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50';
        }
    };

    const handleDayClick = (dateStr: string, currentData?: any) => {
        if (!isAdmin) {
            toast.error("Only Admin can edit past attendance records.");
            return;
        }
        if (!dateStr) return;
        setSelectedDate(dateStr);
        setStatusInput(currentData?.status || "PRESENT");
        setRemarksInput(currentData?.remarks || "");

        // Parse existing time range if available
        if (currentData?.permissionTimeRange && currentData.permissionTimeRange.includes('-')) {
            const [s, e] = currentData.permissionTimeRange.split('-').map((t: string) => t.trim());
            setPermStartTime(s || "10:00");
            setPermEndTime(e || "12:00");
        } else {
            setPermStartTime("10:00");
            setPermEndTime("12:00");
        }
    };

    const [saving, setSaving] = useState(false);

    const handleSaveDay = async () => {
        if (!isAdmin) {
            toast.error("Only Admin can save attendance records.");
            return;
        }
        if (!selectedDate) return;
        setSaving(true);
        try {
            const payload: any = {
                staffId: staff.id,
                staffName: staff.name,
                date: selectedDate,
                status: statusInput as any,
                remarks: remarksInput,
                permissionTimeRange: statusInput === 'PERMISSION' ? `${permStartTime} - ${permEndTime}` : undefined,
                permissionHours: statusInput === 'PERMISSION' ? calPermHrs : 0,
                inTime: statusInput === 'PRESENT' ? "09:00" : "-",
                outTime: "-"
            };
            await staffApi.markAttendance(payload);
            toast.success("Updated!");
            setSelectedDate(null);
            refreshMonthData();
        } catch (e) { toast.error("Failed to update"); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95">
            {/* Fullscreen-ish Modal */}
            <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-7xl h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200 text-xl">
                            {staff.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">{staff.name}</h2>
                            <p className="text-sm text-gray-500 font-medium">{staff.role} • Attendance History</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        {/* Month Navigation */}
                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
                            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={20} /></button>
                            <span className="text-lg font-bold text-gray-800 min-w-[140px] text-center">{format(currentDate, 'MMMM yyyy')}</span>
                            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={20} /></button>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-red-100 hover:text-red-600 rounded-full text-gray-400 transition-colors"><XCircle size={32} /></button>
                    </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="flex-1 flex flex-col p-4 bg-slate-50 overflow-y-auto">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2 shrink-0">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                            <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">{d}</div>
                        ))}
                    </div>

                    {/* Days Grid - Flex-1 to fill remaining space */}
                    <div className="flex-1 grid grid-cols-7 gap-2 min-h-0">
                        {calendarDays.map((d) => {
                            const dateKey = format(d, 'yyyy-MM-dd');
                            const dayData = dataMap[dateKey];
                            const status = dayData?.status;
                            const isCurrentMonth = isSameMonth(d, currentDate);
                            const isTodayDate = isToday(d);

                            return (
                                <div
                                    key={dateKey}
                                    onClick={() => handleDayClick(dateKey, dayData)}
                                    className={`
                                        rounded-xl border flex flex-col p-2 relative transition-all duration-200 cursor-pointer hover:shadow-md min-h-[100px]
                                        ${!isCurrentMonth ? 'opacity-30 grayscale bg-gray-50/50' : ''}
                                        ${getStatusColor(status)}
                                        ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-2 z-10 shadow-lg' : 'shadow-sm'}
                                    `}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-base font-bold ${!status && isCurrentMonth ? 'text-gray-700' : 'opacity-80'}`}>{format(d, 'd')}</span>
                                        {status && (
                                            <div title={status}>
                                                {status === 'PRESENT' && <CheckCircle size={16} />}
                                                {status === 'ABSENT' && <XCircle size={16} />}
                                                {status === 'HALF_DAY' && <Clock size={16} />}
                                                {status === 'PERMISSION' && <User size={16} />}
                                            </div>
                                        )}
                                    </div>

                                    {dayData?.remarks && (
                                        <div className="mt-1 w-full px-0.5 z-20 relative">
                                            <div className="text-xs font-bold text-gray-900 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-1 break-words text-center shadow-sm" title={dayData.remarks}>
                                                {dayData.remarks}
                                            </div>
                                        </div>
                                    )}

                                    {status === 'PERMISSION' && dayData?.permissionTimeRange && (
                                        <div className="mt-1 text-center">
                                            <span className="text-xs font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shadow-sm inline-block">
                                                {dayData.permissionTimeRange}
                                            </span>
                                        </div>
                                    )}

                                    {status && (
                                        <div className="mt-auto flex justify-center pb-1">
                                            <span className="text-[11px] font-extrabold uppercase tracking-wide opacity-100 inline-block px-2 py-0.5 rounded-md bg-white/70 backdrop-blur-sm truncate max-w-full shadow-sm text-gray-800 border border-gray-100">
                                                {status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="p-3 bg-white border-t border-gray-200 flex justify-center gap-8 text-xs text-gray-600 font-medium shrink-0">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div> Present</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div> Absent</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm"></div> Half Day</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div> Permission</div>
                </div>
            </div>

            {selectedDate && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-5 border border-gray-100 animate-in zoom-in-95 duration-200 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />

                        <div className="flex justify-between items-center pb-2">
                            <div>
                                <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">{format(new Date(selectedDate), 'MMM dd')}</h3>
                                <p className="text-xs text-gray-400 font-bold">{format(new Date(selectedDate), 'yyyy')}</p>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-2 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors group">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <Activity size={10} /> Status
                            </label>
                            <select value={statusInput} onChange={e => setStatusInput(e.target.value)} className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-bold bg-gray-50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer">
                                <option value="PRESENT">Present</option>
                                <option value="ABSENT">Absent</option>
                                <option value="HALF_DAY">Half Day</option>
                                <option value="PERMISSION">Permission</option>
                                <option value="LEAVE">Leave</option>
                            </select>
                        </div>

                        {statusInput === 'PERMISSION' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Start</label>
                                        <TimePicker value={permStartTime} onChange={setPermStartTime} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">End</label>
                                        <TimePicker value={permEndTime} onChange={setPermEndTime} />
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-xl text-center border border-blue-100/50 shadow-sm">
                                    <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-0.5">Duration</div>
                                    <div className="text-2xl font-black text-blue-900 tabular-nums">{String(calPermHrs)} <span className="text-sm opacity-50">hrs</span></div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <Edit3 size={10} /> Remarks
                            </label>
                            <textarea
                                value={remarksInput}
                                onChange={e => setRemarksInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveDay();
                                    }
                                }}
                                className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm font-medium bg-gray-50 h-24 resize-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                placeholder="Add any notes..."
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setSelectedDate(null)} className="flex-1 bg-gray-50 text-gray-400 rounded-xl py-3 font-black text-sm hover:bg-gray-100 transition-all active:scale-95 uppercase tracking-wider">
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDay}
                                disabled={saving}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl py-3 font-black text-sm hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? "Saving" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- STAFF FORM MODAL ---
const StaffFormModal = ({ staff, onClose, onSuccess, isAdmin }: any) => {
    const [formData, setFormData] = useState({
        name: '', phone: '', emergencyPhone: '', role: 'Employee',
        baseSalary: 10000, allowedPermHours: 2.0, profilePicUrl: '', isActive: true,
        accountNumber: '', ifscCode: '', commissionPercentage: 0,
        appUsername: '', appPassword: '', appLocation: ''
    });
    const [showModalPassword, setShowModalPassword] = useState(true);

    const nameRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const roleRef = useRef<HTMLSelectElement>(null);
    const emergencyPhoneRef = useRef<HTMLInputElement>(null);
    const salaryRef = useRef<HTMLInputElement>(null);
    const permHoursRef = useRef<HTMLInputElement>(null);
    const accountRef = useRef<HTMLInputElement>(null);
    const ifscRef = useRef<HTMLInputElement>(null);

    const handleEnter = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nextRef.current?.focus();
        }
    };
    const [roles, setRoles] = useState<Role[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetchRoles = async () => { try { const res = await staffApi.getRoles(); setRoles(res.data || []); } catch (e) { } };
        fetchRoles();
        if (staff) {
            setFormData({
                name: staff.name, phone: staff.phone, emergencyPhone: staff.emergencyPhone || '',
                role: staff.role || 'Employee', baseSalary: staff.baseSalary || 10000,
                allowedPermHours: staff.allowedPermHours || 2.0, profilePicUrl: staff.profilePicUrl || '', isActive: staff.isActive,
                accountNumber: staff.accountNumber || '', ifscCode: staff.ifscCode || '',
                commissionPercentage: staff.commissionPercentage || 0,
                appUsername: staff.appUsername || staff.name || '',
                appPassword: staff.appPassword || staff.phone || '',
                appLocation: staff.appLocation || ''
            });
        } else {
            setFormData({
                name: '', phone: '', emergencyPhone: '', role: 'Employee',
                baseSalary: 10000, allowedPermHours: 2.0, profilePicUrl: '', isActive: true,
                accountNumber: '', ifscCode: '', commissionPercentage: 0,
                appUsername: '', appPassword: '', appLocation: ''
            });
        }
    }, [staff]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) {
            toast.error("Permission denied. Only Admin can modify or add staff records.");
            return;
        }
        setIsSaving(true);
        const payload = {
            ...formData,
            appUsername: formData.appUsername.trim() || formData.name.trim(),
            appPassword: formData.appPassword.trim() || formData.phone.trim()
        };
        try {
            if (staff) {
                await staffApi.update(staff.id, payload);
                const updatedStaff = {
                    ...staff,
                    ...payload,
                    appUsername: payload.appUsername,
                    appPassword: payload.appPassword,
                    isActive: payload.isActive !== undefined ? payload.isActive : staff.isActive
                };
                onSuccess(updatedStaff);
            } else {
                const res = await staffApi.add(payload);
                const generatedId = (res?.data && typeof res.data === 'object' && res.data.id)
                    ? res.data.id
                    : (typeof res?.data === 'string' && res.data.trim().length > 0 ? res.data : '')
                    || `S-${Date.now().toString().slice(-5)}`;
                const newStaff = {
                    ...payload,
                    id: generatedId,
                    appUsername: payload.appUsername,
                    appPassword: payload.appPassword,
                    createdAt: new Date().toISOString(),
                    active: true,
                    isActive: true
                };
                onSuccess(newStaff);
            }
            toast.success("Saved successfully");
        } catch (error) {
            console.error(error);
            toast.error("Operation failed");
        }
        finally { setIsSaving(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple validation
        if (file.size > 5 * 1024 * 1024) { // 5MB
            toast.error("File size must be less than 5MB");
            return;
        }

        setUploading(true);
        try {
            const timestamp = Date.now();
            // Sanitize filename
            const fileName = `staff-profiles/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const storageRef = ref(storage, fileName);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            setFormData(prev => ({ ...prev, profilePicUrl: downloadURL }));
            toast.success("Image uploaded!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to upload image");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">{staff ? 'Edit Staff' : 'Add New Staff'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"><XCircle size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Full Name</label>
                            <input ref={nameRef} required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} onKeyDown={(e) => handleEnter(e, phoneRef)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Phone Number</label>
                            <input ref={phoneRef} required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} onKeyDown={(e) => handleEnter(e, roleRef)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Role</label>
                            <select ref={roleRef} className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} onKeyDown={(e) => handleEnter(e, emergencyPhoneRef)}>{roles.length > 0 ? roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>) : <option>Employee</option>}</select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Emergency Contact</label>
                            <input ref={emergencyPhoneRef} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" value={formData.emergencyPhone} onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })} onKeyDown={(e) => handleEnter(e, salaryRef)} />
                        </div>
                    </div>

                    {/* EXTENDED SALARY & BANK CONFIG */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Salary Config */}
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col gap-3">
                            <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2"><DollarSign size={16} /> Salary Info</h4>

                            <div>
                                <label className="block text-xs font-bold text-blue-600/70 mb-1">Monthly Base Salary (₹)</label>
                                <input ref={salaryRef} type="number" className="w-full border border-blue-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono" value={formData.baseSalary} onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })} onKeyDown={(e) => handleEnter(e, permHoursRef)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-600/70 mb-1">Allowed Permission (Hrs)</label>
                                <input ref={permHoursRef} type="number" step="0.5" className="w-full border border-blue-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono" value={formData.allowedPermHours} onChange={e => setFormData({ ...formData, allowedPermHours: Number(e.target.value) })} onKeyDown={(e) => handleEnter(e, accountRef)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-600/70 mb-1">Commission (%)</label>
                                <input type="number" step="0.1" className="w-full border border-blue-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono" value={formData.commissionPercentage} onChange={e => setFormData({ ...formData, commissionPercentage: Number(e.target.value) })} />
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-3">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Briefcase size={16} /> Bank Details</h4>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Account Number</label>
                                <input ref={accountRef} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono text-sm" value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} onKeyDown={(e) => handleEnter(e, ifscRef)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">IFSC Code</label>
                                <input ref={ifscRef} className="w-full border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono text-sm uppercase" value={formData.ifscCode} onChange={e => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(e as any); } }} />
                            </div>
                        </div>
                    </div>

                    {/* App Login / Self Attendance Credentials */}
                    <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 flex flex-col gap-3">
                        <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                            <Lock size={16} className="text-amber-600" /> Terminal / Punch-In Login Credentials
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-amber-800/80 mb-1">App Username</label>
                                <input
                                    className="w-full border border-amber-200 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm"
                                    placeholder={formData.name || "e.g. JUSTIN JEEVA"}
                                    value={formData.appUsername}
                                    onChange={e => setFormData({ ...formData, appUsername: e.target.value })}
                                />
                                <span className="text-[10px] text-amber-700/70">Used by staff to punch in at cashier terminal</span>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-amber-800/80 mb-1">App Password</label>
                                <div className="relative">
                                    <input
                                        type={showModalPassword ? "text" : "password"}
                                        className="w-full border border-amber-200 rounded-lg p-2.5 pr-10 focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm font-mono"
                                        placeholder={formData.phone || "e.g. 8248327187"}
                                        value={formData.appPassword}
                                        onChange={e => setFormData({ ...formData, appPassword: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowModalPassword(!showModalPassword)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                                        title={showModalPassword ? "Hide Password" : "Show Password"}
                                    >
                                        {showModalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <span className="text-[10px] text-amber-700/70">Defaults to staff phone number if left blank</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide flex items-center gap-2">
                            <UploadCloud size={16} /> Profile Picture
                        </label>

                        <div className="flex items-center gap-4">
                            <div className="shrink-0">
                                {formData.profilePicUrl ? (
                                    <div className="relative group/img w-20 h-20">
                                        <img src={formData.profilePicUrl} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, profilePicUrl: '' })}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-sm opacity-0 group-hover/img:opacity-100 transition-opacity"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-200">
                                        <User size={32} />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 relative group bg-white">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                                    disabled={uploading}
                                />
                                <div className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all duration-200 
                                    ${uploading ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'}`}>

                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-2 text-blue-600">
                                            <Loader2 size={24} className="animate-spin" />
                                            <span className="text-sm font-semibold">Uploading...</span>
                                        </div>
                                    ) : (
                                        <div className="flex gap-3 items-center text-gray-500 group-hover:text-blue-600 transition-colors">
                                            <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                                                <UploadCloud size={20} />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-700">Click to upload</p>
                                                <p className="text-xs text-gray-400">SVG, PNG, JPG or GIF (max. 5MB)</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input type="checkbox" id="active" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                        <label htmlFor="active" className="text-sm font-medium text-gray-700 cursor-pointer select-none">Active Staff Member</label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            {isSaving ? "Saving..." : "Save Staff"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- NEW COMPONENT: TIME PICKER ---
const TimePicker = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
    const [hours, setHours] = useState(value.split(':')[0] || "10");
    const [minutes, setMinutes] = useState(value.split(':')[1] || "00");

    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minuteOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // 00, 05, 10...

    const hourRef = useRef<HTMLDivElement>(null);
    const minRef = useRef<HTMLDivElement>(null);

    const handleHourChange = (newHour: string) => {
        setHours(newHour);
        onChange(`${newHour}:${minutes}`);
    };

    const handleMinuteChange = (newMinute: string) => {
        setMinutes(newMinute);
        onChange(`${hours}:${newMinute}`);
    };

    // Update internal state if valid prop changes
    useEffect(() => {
        if (value && value.includes(':')) {
            const [h, m] = value.split(':');
            if (h) setHours(h);
            if (m) setMinutes(m);
        }
    }, [value]);

    // Auto-scroll logic
    useEffect(() => {
        if (hourRef.current) {
            const idx = hourOptions.indexOf(hours);
            if (idx !== -1) {
                hourRef.current.scrollTo({ top: idx * 32, behavior: 'smooth' });
            }
        }
    }, [hours, hourOptions]);

    useEffect(() => {
        if (minRef.current) {
            const idx = minuteOptions.indexOf(minutes);
            if (idx !== -1) {
                minRef.current.scrollTo({ top: idx * 32, behavior: 'smooth' });
            }
        }
    }, [minutes, minuteOptions]);

    return (
        <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner h-36 relative group">
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                <div className="w-full h-8 bg-blue-600/10 border-t border-b border-blue-500/20" />
            </div>

            {/* Hours Column */}
            <div
                ref={hourRef}
                className="flex-1 overflow-y-auto no-scrollbar snap-y snap-mandatory py-14"
            >
                {hourOptions.map(h => (
                    <div
                        key={h}
                        onClick={() => handleHourChange(h)}
                        className={`h-8 flex items-center justify-center text-lg font-bold snap-center cursor-pointer transition-all duration-300 ${hours === h ? 'text-blue-600 scale-125 z-20' : 'text-gray-400 opacity-40 hover:opacity-100 hover:text-gray-600'}`}
                    >
                        {h}
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-center font-black text-blue-200 pb-1 text-xl">:</div>

            {/* Minutes Column */}
            <div
                ref={minRef}
                className="flex-1 overflow-y-auto no-scrollbar snap-y snap-mandatory py-14"
            >
                {minuteOptions.map(m => (
                    <div
                        key={m}
                        onClick={() => handleMinuteChange(m)}
                        className={`h-8 flex items-center justify-center text-lg font-bold snap-center cursor-pointer transition-all duration-300 ${minutes === m ? 'text-blue-600 scale-125 z-20' : 'text-gray-400 opacity-40 hover:opacity-100 hover:text-gray-600'}`}
                    >
                        {m}
                    </div>
                ))}
            </div>



            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-gray-50 to-transparent pointer-events-none z-0" />
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none z-0" />
        </div>
    );
};

export default StaffManagement;