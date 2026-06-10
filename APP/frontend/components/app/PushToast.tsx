import React from 'react';

interface PushToastProps {
  notification: { title: string; body: string } | null;
  onClose: () => void;
}

const PushToast: React.FC<PushToastProps> = ({ notification, onClose }) => {
  if (!notification) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] max-w-sm bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl p-4 animate-slide-in border border-slate-200/50">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div>
          <p className="font-bold text-slate-900 text-sm">{notification.title}</p>
          <p className="text-slate-600 text-xs mt-1">{notification.body}</p>
        </div>
        <button onClick={onClose} className="text-rose-400 text-sm ml-auto hover:text-rose-200 transition-colors duration-200">✕</button>
      </div>
    </div>
  );
};

export default PushToast;


