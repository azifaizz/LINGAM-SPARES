import React from 'react';
import { Notification } from '@/lib/api';
import ModalPortal from './ModalPortal';
import { modalRegistry } from './ModalRegistry';
import GenericNotificationModal from './modals/GenericNotificationModal';

interface NotificationModalRendererProps {
    notification: Notification | null;
    onClose: () => void;
    onAction: (notification: Notification) => void;
}

const NotificationModalRenderer: React.FC<NotificationModalRendererProps> = ({
    notification,
    onClose,
    onAction,
}) => {
    if (!notification) return null;

    const ModalComponent = modalRegistry[notification.type] || GenericNotificationModal;

    return (
        <ModalPortal>
            <ModalComponent
                notification={notification}
                onClose={onClose}
                onAction={onAction}
            />
        </ModalPortal>
    );
};

export default NotificationModalRenderer;
