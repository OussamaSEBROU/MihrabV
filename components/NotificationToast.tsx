import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

interface NotificationToastProps {
  notification: ToastNotification;
  onClose: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="fixed top-6 left-6 right-6 z-[9999] bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-start gap-4"
    >
      <div className="bg-red-600/20 p-2 rounded-full">
        <Bell size={18} className="text-red-500" />
      </div>
      <div className="flex-1">
        <h4 className="text-white font-bold text-sm tracking-tight">{notification.title}</h4>
        <p className="text-white/60 text-xs mt-0.5">{notification.message}</p>
      </div>
      <button onClick={() => onClose(notification.id)} className="text-white/30 hover:text-white">
        <X size={16} />
      </button>
    </motion.div>
  );
};
