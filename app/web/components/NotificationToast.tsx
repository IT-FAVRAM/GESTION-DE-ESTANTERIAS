
import React, { useEffect } from 'react';
import { CloseIcon, InfoIcon, BellIcon } from './Icons';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
}

interface NotificationToastProps {
    notification: Notification;
    onClose: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(notification.id);
        }, 6000); // Auto close after 6s
        return () => clearTimeout(timer);
    }, [notification.id, onClose]);

    const colors = {
        info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/80 dark:border-blue-700 dark:text-blue-100',
        success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/80 dark:border-green-700 dark:text-green-100',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/80 dark:border-yellow-700 dark:text-yellow-100',
        error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/80 dark:border-red-700 dark:text-red-100',
    };

    return (
        <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-in-right max-w-sm w-full pointer-events-auto ${colors[notification.type]} hover:${notification.type === 'success' ? 'bg-green-100' : notification.type === 'info' ? 'bg-blue-100' : notification.type === 'warning' ? 'bg-yellow-100' : 'bg-red-100'} transition-colors duration-200`}>
            <div className="flex-shrink-0 mt-0.5">
                {notification.type === 'warning' || notification.type === 'error' ? 
                    <BellIcon className="h-5 w-5 animate-pulse" /> : 
                    <InfoIcon className="h-5 w-5" />
                }
            </div>
            <div className="flex-grow">
                <h4 className="font-bold text-sm">{notification.title}</h4>
                <p className="text-xs mt-1 opacity-90">{notification.message}</p>
            </div>
            <button onClick={() => onClose(notification.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-colors duration-200">
                <CloseIcon className="h-4 w-4" />
            </button>
        </div>
    );
};

export default NotificationToast;
