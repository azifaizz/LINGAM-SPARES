import React, { useEffect } from 'react';
import { Bell, X, Check, Inbox, Loader2 } from 'lucide-react';
import { Notification } from '@/lib/api';
import ModalPortal from './ModalPortal';

interface NotificationListModalProps {
    notifications: Notification[];
    isOpen: boolean;
    isLoading?: boolean;
    onClose: () => void;
    onSelect: (notification: Notification) => void;
    onMarkAsRead: (id: string, e: React.MouseEvent) => void;
}

const NotificationListModal: React.FC<NotificationListModalProps> = ({
    notifications,
    isOpen,
    isLoading = false,
    onClose,
    onSelect,
    onMarkAsRead,
}) => {
    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                {/* Backdrop Container */}
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ease-out animate-in fade-in"
                    onClick={onClose}
                />

                {/* Modal Card - Match Image 2 Dimensions */}
                <div className="relative w-[520px] min-h-[260px] max-h-[75vh] bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden transform transition-all duration-250 ease-out animate-in zoom-in-95 fade-in">
                    <div className="px-5 py-4 border-b flex justify-between items-center bg-white">
                        <div className="flex items-center gap-2">
                            <Bell size={18} className="text-blue-500" />
                            <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Notifications</h3>
                            {notifications.length > 0 && !isLoading && (
                                <span className="ml-1 text-xs font-medium text-gray-500">
                                    ({notifications.length} unread)
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 px-6 h-full min-h-[200px]">
                                <Loader2 size={28} className="text-blue-500 animate-spin mb-4" />
                                <p className="text-sm font-medium text-gray-700">Loading notifications...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-6 h-full min-h-[200px]">
                                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4 transition-transform duration-300">
                                    <Inbox size={28} />
                                </div>
                                <p className="text-sm font-medium text-gray-700">All caught up!</p>
                                <p className="text-xs text-gray-400 mt-1">We'll notify you when something comes up.</p>
                            </div>
                        ) : (
                            <div className="px-2 py-2">
                                {notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        onClick={() => onSelect(n)}
                                        className="px-4 py-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-all duration-200 group flex items-center justify-between border border-transparent hover:border-gray-100 mb-1"
                                    >
                                        <div className="flex-1 pr-4">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-blue-600 transition-colors">
                                                    {n.title}
                                                </p>
                                                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                                    {n.type.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                                                {n.message}
                                            </p>
                                            <p className="text-xs text-gray-400 font-medium mt-1.5 flex items-center gap-1">
                                                <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onMarkAsRead(n.id, e);
                                                }}
                                                className="p-2 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all"
                                                title="Mark as read"
                                            >
                                                <Check size={16} strokeWidth={2.5} />
                                            </button>
                                            <div className="text-gray-300 group-hover:translate-x-0.5 transition-transform duration-200">
                                                <X size={14} className="rotate-45" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="px-5 py-3 bg-gray-50/50 border-t flex justify-center">
                        <button
                            onClick={onClose}
                            className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest py-1"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default NotificationListModal;
