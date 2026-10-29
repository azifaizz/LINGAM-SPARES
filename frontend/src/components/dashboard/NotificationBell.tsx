import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Bell, X, AlertCircle, Check, Calendar, Clock, 
    Users, FileText, ChevronRight, CheckCheck, Trash2, ArrowUpRight
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useGlobalData } from '@/context/GlobalDataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const NotificationBell: React.FC = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const trayRef = useRef<HTMLDivElement>(null);
    const { bills = [], customers = [] } = useGlobalData();
    const navigate = useNavigate();

    // Close tray when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (trayRef.current && !trayRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Navigate to Customer Details
    const handleViewCustomer = (notification: any) => {
        markAsRead(notification.id);
        setIsOpen(false);
        setSelectedNotification(null);

        if (notification.customerId) {
            navigate(`/admin/customers/${notification.customerId}?billId=${notification.billId}`);
            return;
        }

        if (notification.customerPhone) {
            const foundCustomer = customers.find((c: any) => c.phone === notification.customerPhone.toString());
            if (foundCustomer) {
                navigate(`/admin/customers/${foundCustomer.id}?billId=${notification.billId}`);
                return;
            }
        }

        navigate(`/admin/customers?highlight=${notification.customerPhone || notification.id}&status=${notification.status}&billId=${notification.billId}`);
    };

    // Open Bill / Invoice
    const handleViewBill = (notification: any) => {
        markAsRead(notification.id);
        setIsOpen(false);
        setSelectedNotification(null);
        if (notification.billId) {
            window.open(`/bill/${notification.billId}`, '_blank');
        }
    };

    // Open detail modal and close dropdown tray to prevent overlap
    const handleOpenDetailModal = (notification: any) => {
        markAsRead(notification.id);
        setIsOpen(false);
        setSelectedNotification(notification);
    };

    const getStatusTheme = (status: string) => {
        switch (status) {
            case 'OVERDUE':
                return {
                    badge: 'bg-rose-100 text-rose-700 border-rose-200',
                    iconBg: 'bg-rose-50 text-rose-600',
                    headerBg: 'bg-gradient-to-r from-rose-500 to-red-600 text-white',
                    label: 'Overdue'
                };
            case 'WARNING':
                return {
                    badge: 'bg-amber-100 text-amber-800 border-amber-200',
                    iconBg: 'bg-amber-50 text-amber-600',
                    headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
                    label: 'Due Soon'
                };
            default:
                return {
                    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    iconBg: 'bg-emerald-50 text-emerald-600',
                    headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
                    label: 'On Track'
                };
        }
    };

    // Find bill details for the selected notification
    const matchedBill = selectedNotification
        ? bills.find((b: any) => b.id === selectedNotification.billId)
        : null;

    const pendingAmount = matchedBill
        ? (matchedBill.pendingAmount !== undefined && matchedBill.pendingAmount !== null
            ? Number(matchedBill.pendingAmount)
            : Math.max(0, (matchedBill.finalAmount || 0) - (matchedBill.amountPaid || 0)))
        : null;

    return (
        <div className="relative" ref={trayRef}>
            {/* Bell Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                title="Notifications"
                aria-label="Notifications"
            >
                <div className={unreadCount > 0 ? "animate-bell-ring origin-top inline-block" : "origin-top inline-block"}>
                    <Bell size={22} className={unreadCount > 0 ? "text-blue-600" : "text-slate-600"} />
                </div>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full border-2 border-white shadow-sm min-w-[18px] text-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Tray Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                    <Bell size={16} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Payment Deadlines</h3>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {notifications.length > 0 && unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck size={13} />
                                        <span>Mark all read</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center space-y-2">
                                    <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                                        <Bell size={24} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">No Pending Deadlines</p>
                                    <p className="text-xs text-slate-400 max-w-[200px] mx-auto">
                                        All partial customer payments are up to date.
                                    </p>
                                </div>
                            ) : (
                                notifications.map((n) => {
                                    const theme = getStatusTheme(n.status);
                                    return (
                                        <div
                                            key={n.id}
                                            onClick={() => handleOpenDetailModal(n)}
                                            className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors relative group ${
                                                !n.read ? 'bg-blue-50/25' : ''
                                            }`}
                                        >
                                            {!n.read && (
                                                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full shadow-sm" />
                                            )}

                                            <div className="flex gap-3 items-start">
                                                <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${theme.iconBg}`}>
                                                    <AlertCircle size={16} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                        <h4 className="font-bold text-xs text-slate-800 truncate">
                                                            {n.productName || 'Partial Payment Due'}
                                                        </h4>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${theme.badge} shrink-0`}>
                                                            {n.status === 'OVERDUE'
                                                                ? 'Overdue'
                                                                : `${n.daysRemaining}d left`}
                                                        </span>
                                                    </div>

                                                    <p className="text-[11px] text-slate-600 font-medium truncate">
                                                        {n.customerName || 'Customer'}
                                                        {n.customerPhone && (
                                                            <span className="text-slate-400 font-normal"> • {n.customerPhone}</span>
                                                        )}
                                                    </p>

                                                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {n.billId?.slice(-8) || ''}
                                                        </span>

                                                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => handleViewCustomer(n)}
                                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                                            >
                                                                <Users size={11} />
                                                                <span>Customer</span>
                                                            </button>

                                                            <button
                                                                onClick={() => handleViewBill(n)}
                                                                className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                                            >
                                                                <FileText size={11} />
                                                                <span>Invoice</span>
                                                            </button>

                                                            <button
                                                                onClick={() => deleteNotification(n.id)}
                                                                className="p-1 text-slate-300 hover:text-rose-500 rounded-md transition-colors"
                                                                title="Dismiss"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Portal-Rendered Detail Modal (Centered on Viewport, never clipped by header) */}
            {selectedNotification && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    <div 
                        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedNotification(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col"
                        >
                            {/* Modal Header */}
                            {(() => {
                                const theme = getStatusTheme(selectedNotification.status);
                                return (
                                    <div className={`p-5 flex justify-between items-center ${theme.headerBg}`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                                <AlertCircle size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-black tracking-wide uppercase">
                                                    Payment Deadline Alert
                                                </h3>
                                                <p className="text-xs text-white/80 font-medium">
                                                    {selectedNotification.status === 'OVERDUE'
                                                        ? 'This payment deadline has passed'
                                                        : `Due in ${selectedNotification.daysRemaining} days`}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedNotification(null)}
                                            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* Modal Body */}
                            <div className="p-6 space-y-4">
                                {/* Product / Reference Banner */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Associated Product / Items
                                    </p>
                                    <h4 className="text-base font-black text-slate-800">
                                        {selectedNotification.productName || 'Multiple Products'}
                                    </h4>
                                    {selectedNotification.billId && (
                                        <p className="text-xs font-mono font-bold text-blue-600">
                                            Invoice ID: {selectedNotification.billId}
                                        </p>
                                    )}
                                </div>

                                {/* Customer Card */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Customer</p>
                                        <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">
                                            {selectedNotification.customerName || 'N/A'}
                                        </p>
                                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                                            {selectedNotification.customerPhone || 'No contact'}
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Deadline Status</p>
                                        <p className={`text-sm font-black mt-0.5 ${
                                            selectedNotification.status === 'OVERDUE'
                                                ? 'text-rose-600'
                                                : selectedNotification.status === 'WARNING'
                                                ? 'text-amber-600'
                                                : 'text-emerald-600'
                                        }`}>
                                            {selectedNotification.status === 'OVERDUE'
                                                ? 'Overdue'
                                                : `${selectedNotification.daysRemaining} Days Left`}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {new Date(selectedNotification.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Financial details if matchedBill is available */}
                                {matchedBill && (
                                    <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100/80 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-blue-600">Pending Balance</p>
                                            <p className="text-lg font-black text-slate-900 mt-0.5">
                                                ₹{pendingAmount !== null ? pendingAmount.toLocaleString() : '—'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold text-slate-400">Total Invoice</p>
                                            <p className="text-sm font-bold text-slate-600 mt-0.5">
                                                ₹{(matchedBill.finalAmount || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-2 space-y-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleViewCustomer(selectedNotification)}
                                            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
                                        >
                                            <Users size={14} />
                                            <span>View Customer</span>
                                        </button>

                                        <button
                                            onClick={() => handleViewBill(selectedNotification)}
                                            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition flex items-center justify-center gap-1.5"
                                        >
                                            <FileText size={14} />
                                            <span>View Invoice</span>
                                            <ArrowUpRight size={13} className="text-slate-400" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setSelectedNotification(null)}
                                        className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition text-center"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export default NotificationBell;
