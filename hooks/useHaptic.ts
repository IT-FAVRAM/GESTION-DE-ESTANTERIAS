import { useCallback } from 'react';

type HapticPattern = 'success' | 'error' | 'warning' | 'selection' | 'impact';

/**
 * Hook to provide consistent haptic feedback across the application.
 * Uses navigator.vibrate if available.
 */
export const useHaptic = () => {
    const triggerHaptic = useCallback((pattern: HapticPattern) => {
        if (typeof navigator === 'undefined' || !navigator.vibrate) return;

        try {
            switch (pattern) {
                case 'success':
                    // Light distinct tap
                    navigator.vibrate(50);
                    break;
                case 'error':
                    // Double heavy vibration
                    navigator.vibrate([100, 50, 100]);
                    break;
                case 'warning':
                    // Single medium vibration
                    navigator.vibrate(200);
                    break;
                case 'selection':
                    // Very light tap for UI interactions
                    navigator.vibrate(10);
                    break;
                case 'impact':
                    // Heavy impact
                    navigator.vibrate(70);
                    break;
            }
        } catch (e) {
            // Ignore errors if vibration fails or is not supported/allowed
            console.warn("Haptic feedback failed", e);
        }
    }, []);

    return { triggerHaptic };
};
