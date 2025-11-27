"use client";

import { useOnlineStatus } from '@/hooks/use-online-status';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ConnectionStatusIndicator() {
  const isOnline = useOnlineStatus();
  const [showSyncing, setShowSyncing] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false);
      return;
    }

    if (isOnline) {
      setShowSyncing(true);
      const timer = setTimeout(() => setShowSyncing(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isFirstLoad]);

  if (isOnline && !showSyncing) {
    return null;
  }

  let text = 'Offline';
  let Icon = WifiOff;
  let bgColor = 'bg-destructive/80';
  if (showSyncing) {
    text = 'Sincronizando...';
    Icon = Wifi;
    bgColor = 'bg-yellow-500/80';
  }


  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-white shadow-lg backdrop-blur-sm",
      bgColor
    )}>
      <Icon className="h-5 w-5" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}
