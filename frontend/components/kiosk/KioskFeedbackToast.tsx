import React from 'react';
import type { KioskFeedback } from './kioskShared';

interface KioskFeedbackToastProps {
  feedback: KioskFeedback | null;
}

const KioskFeedbackToast: React.FC<KioskFeedbackToastProps> = ({ feedback }) => {
  if (!feedback) return null;

  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl font-bold text-lg animate-bounce-in ${feedback.type === 'success' ? 'bg-emerald-600/90 text-white border border-emerald-500/50' : 'bg-red-600/90 text-white border border-red-500/50'} hover:${feedback.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} transition-colors duration-200`}>
      {feedback.message}
    </div>
  );
};

export default KioskFeedbackToast;


