import { Notification } from '@/lib/api';
import React from 'react';
import BillExpiryModal from './modals/BillExpiryModal';
import LowStockModal from './modals/LowStockModal';

export interface ModalProps {
    notification: Notification;
    onClose: () => void;
    onAction: (notification: Notification) => void;
}

export const modalRegistry: Record<string, React.FC<ModalProps>> = {
    'BILL_EXPIRY': BillExpiryModal,
    'LOW_STOCK': LowStockModal,
    // New types can be added here
};
