import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { useGlobalData } from './GlobalDataContext';
import { billingApi } from '@/lib/api';

interface Notification {
    id: string;
    billId: string;
    customerId: string;
    productName: string;
    productBarcode: string;
    customerName: string;
    customerPhone: string;
    status: 'SAFE' | 'WARNING' | 'OVERDUE';
    daysRemaining: number;
    timestamp: number;
    read: boolean;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    deleteNotification: (id: string) => void;
    refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { bills } = useGlobalData();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    const fetchNotifications = async () => {
        try {
            const res = await billingApi.getNotifications();
            const fetchedBills = res.data || [];
            
            const mapped: Notification[] = fetchedBills.map(bill => {
                const createdDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
                const createdMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
                const todayMidnight = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                const diffTime = todayMidnight.getTime() - createdMidnight.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const totalDays = (bill.expiryDays !== undefined && bill.expiryDays !== null) ? Number(bill.expiryDays) : 30;
                const remainingDays = totalDays - diffDays;

                let status: 'SAFE' | 'WARNING' | 'OVERDUE' = 'SAFE';
                if (remainingDays < 0) {
                    status = 'OVERDUE';
                } else if (remainingDays <= totalDays / 2) {
                    status = 'WARNING';
                }

                const firstItem = bill.items?.[0];
                const firstProduct = firstItem?.productName || 'Multiple Products';
                const firstBarcode = firstItem?.productId || '';

                return {
                    id: bill.id!,
                    billId: bill.id!,
                    customerId: bill.customerId || '',
                    productName: firstProduct,
                    productBarcode: firstBarcode,
                    customerName: bill.customerName,
                    customerPhone: bill.customerPhone?.toString() || '',
                    status,
                    daysRemaining: remainingDays,
                    timestamp: Date.now(),
                    read: readIds.has(bill.id!)
                };
            });
            setNotifications(mapped);
        } catch (error) {
            console.error("Error fetching notifications:", error);
            setNotifications([]);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (id: string) => {
        setReadIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        const allIds = notifications.map(n => n.id);
        setReadIds(new Set(allIds));
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const deleteNotification = (id: string) => {
        // Since we fetch dynamically, deleting locally only lasts until next refresh
        // unless we exclude it. But the requirement is to derive from DB.
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            refreshNotifications: fetchNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
