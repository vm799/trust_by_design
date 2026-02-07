import React, { useEffect, useState } from 'react';

export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

export const OfflineBanner: React.FC = React.memo(() => {
    const isOnline = useOnlineStatus();
    if (isOnline) return null;
    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-slate-950 py-2 px-4 text-center">
            <div className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">cloud_off</span>
                <span className="text-xs font-medium">
                    Offline - Using Cached Data
                </span>
            </div>
        </div>
    );
});

OfflineBanner.displayName = 'OfflineBanner';
