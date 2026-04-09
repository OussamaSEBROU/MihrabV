import React, { createContext, useContext, useState, useCallback } from 'react';
import { NotificationToast, ToastNotification } from './NotificationToast';
import { AnimatePresence } from 'framer-motion';

interface NotificationContextType {
  showNotification: (title: string, message: string, type: 'info' | 'success' | 'warning') => void;
  showSystemNotification: (title: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const showNotification = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const showSystemNotification = useCallback((title: string, message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  }, []);

  const closeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, showSystemNotification }}>
      {children}
      <AnimatePresence>
        {notifications.map(n => (
          <NotificationToast key={n.id} notification={n} onClose={closeNotification} />
        ))}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};
