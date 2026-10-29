import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { notificationApi, Notification } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import NotificationListModal from './NotificationListModal';

interface NotificationBellProps {
    className?: string;
    iconClassName?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ 
    className = "p-2 rounded-full hover:bg-gray-100 relative transition-colors group",
    iconClassName = "text-gray-600 group-hover:text-blue-600 transition-colors"
}) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isListOpen, setIsListOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const lastFetchRef = useRef<number>(0);

    const fetchNotifications = async () => {
        try {
            setIsLoading(true);
            const res = await notificationApi.getUnread();
            setNotifications(res.data || []);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const safeFetch = async () => {
            if (Date.now() - lastFetchRef.current < 60000) return;
            lastFetchRef.current = Date.now();
            await fetchNotifications();
        };
        safeFetch();
        const interval = setInterval(safeFetch, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleOpenClick = async () => {
        setIsListOpen(true);
        // Fetch fresh notifications when opened
        lastFetchRef.current = Date.now();
        await fetchNotifications();
    };

    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await notificationApi.markAsRead(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            toast.error("Failed to mark as read");
        }
    };

    const handleSelectNotification = async (notification: Notification) => {
        try {
            // 1. Close list immediately for speed
            setIsListOpen(false);

            // 2. Mark as read
            await handleMarkAsRead(notification.id);

            // 3. Navigate generically based on ID presence
            if (notification.relatedId && notification.relatedBillId) {
                const prefix = window.location.pathname.startsWith('/admin') ? '/admin' : '/cashier';
                const url = `${prefix}/customers?id=${notification.relatedId}&billId=${notification.relatedBillId}`;
                navigate(url);
            }
        } catch (err) {
            console.error("Selection failed", err);
        }
    };

    return (
        <>
            <button
                onClick={handleOpenClick}
                className={className}
                aria-label="Open notifications"
            >
                <Bell size={20} className={iconClassName} />
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-pulse border-2 border-white">
                        {notifications.length}
                    </span>
                )}
            </button>

            {/* Notification List Modal */}
            <NotificationListModal
                notifications={notifications}
                isOpen={isListOpen}
                isLoading={isLoading}
                onClose={() => setIsListOpen(false)}
                onSelect={handleSelectNotification}
                onMarkAsRead={handleMarkAsRead}
            />
        </>
    );
};

export default NotificationBell;
