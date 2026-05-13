import { useEffect, useState, useRef } from 'react';
import { useHaptic } from './useHaptic';

export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0); // 0 to 100
    const startY = useRef(0);
    const { triggerHaptic } = useHaptic();
    const isDragging = useRef(false);
    const pullProgressRef = useRef(0);
    const isRefreshingRef = useRef(false);

    useEffect(() => {
        pullProgressRef.current = pullProgress;
    }, [pullProgress]);

    useEffect(() => {
        isRefreshingRef.current = isRefreshing;
    }, [isRefreshing]);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            if (window.scrollY === 0) {
                startY.current = e.touches[0].clientY;
                isDragging.current = true;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging.current) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY.current;

            if (diff > 0 && window.scrollY === 0) {
                // Dragging down at the top
                const progress = Math.min((diff / 150) * 100, 100);
                setPullProgress(progress);

                // Prevent default pull-to-refresh of browser if possible, 
                // but usually we just let it exist or this is for PWA.
                // In generic browser, overscroll-behavior-y: contain helps.
            } else {
                setPullProgress(0);
            }
        };

        const handleTouchEnd = async () => {
            isDragging.current = false;
            if (pullProgressRef.current >= 100 && !isRefreshingRef.current) {
                triggerHaptic('success');
                setIsRefreshing(true);
                setPullProgress(0);
                try {
                    await onRefresh();
                } finally {
                    setIsRefreshing(false);
                    triggerHaptic('success');
                }
            } else {
                setPullProgress(0);
            }
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, triggerHaptic]);

    return { isRefreshing, pullProgress };
};
