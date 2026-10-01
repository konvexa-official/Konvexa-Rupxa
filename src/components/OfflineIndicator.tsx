import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 transition-all duration-300 pointer-events-auto">
      {!isOnline ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#111111] text-[#E6CA65] border border-[#D4AF37]/40 shadow-xl backdrop-blur-md text-xs font-bold animate-pulse">
          <WifiOff className="w-4 h-4 text-[#D4AF37]" />
          <span>Offline Mode · Changes saved locally</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#111111] text-emerald-400 border border-emerald-500/40 shadow-xl backdrop-blur-md text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <Wifi className="w-4 h-4 text-emerald-400" />
          <span>Back Online · Synced</span>
        </div>
      )}
    </div>
  );
};
