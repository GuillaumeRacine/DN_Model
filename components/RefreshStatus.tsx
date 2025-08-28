import { useAppStore } from '../lib/store';
import { useState, useEffect } from 'react';
import { dataCache } from '../lib/data-cache';

interface RefreshStatusProps {
  className?: string;
  showNextRefresh?: boolean;
  showCacheDetails?: boolean;
}

export default function RefreshStatus({ 
  className = '',
  showNextRefresh = true,
  showCacheDetails = false 
}: RefreshStatusProps) {
  const { 
    isRefreshing, 
    lastRefreshTime, 
    nextRefreshTime, 
    triggerManualRefresh 
  } = useAppStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cacheMetadata, setCacheMetadata] = useState<Record<string, any>>({});

  // Update current time every second for real-time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      if (showCacheDetails) {
        setCacheMetadata(dataCache.getAllMetadata());
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [showCacheDetails]);

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = currentTime;
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ${diffMinutes % 60}m ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  const formatTimeUntil = (date: Date | null): string => {
    if (!date) return 'Unknown';
    
    const now = currentTime;
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Due now';
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffHours > 0) return `${diffHours}h ${diffMinutes % 60}m`;
    return `${diffMinutes}m`;
  };

  const getRefreshStatusColor = (): string => {
    if (isRefreshing) return 'text-blue-600';
    if (!lastRefreshTime) return 'text-gray-500';
    
    const now = currentTime;
    const age = now.getTime() - lastRefreshTime.getTime();
    const maxAge = 60 * 60 * 1000; // 60 minutes
    
    if (age > maxAge * 0.9) return 'text-orange-600'; // Near expiry
    if (age > maxAge * 0.7) return 'text-yellow-600'; // Getting old
    return 'text-green-600'; // Fresh
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    await triggerManualRefresh();
  };

  if (showCacheDetails) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 text-xs ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(cacheMetadata).map(([key, meta]) => (
            <div key={key} className="space-y-1">
              <div className="font-medium text-gray-700 dark:text-gray-300">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Updated: {formatTimeAgo(new Date(meta.timestamp))}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                Source: {meta.source}
              </div>
              {meta.isExpired && (
                <div className="text-red-600 text-xs">⚠️ Expired</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between text-xs ${className}`}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isRefreshing 
              ? 'bg-blue-600 animate-pulse' 
              : lastRefreshTime 
                ? 'bg-green-600' 
                : 'bg-gray-400'
          }`}></div>
          <span className={`font-medium ${getRefreshStatusColor()}`}>
            {isRefreshing 
              ? 'Refreshing data...' 
              : `Last updated: ${formatTimeAgo(lastRefreshTime)}`
            }
          </span>
        </div>
        
        {showNextRefresh && nextRefreshTime && !isRefreshing && (
          <div className="text-gray-500 dark:text-gray-400">
            Next auto-refresh: {formatTimeUntil(nextRefreshTime)}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="text-gray-500 dark:text-gray-400">
          {currentTime.toLocaleTimeString()}
        </div>
        
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            isRefreshing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          title={isRefreshing ? 'Refresh in progress' : 'Refresh all data now'}
        >
          {isRefreshing ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Refreshing
            </span>
          ) : (
            '🔄 Refresh'
          )}
        </button>
      </div>
    </div>
  );
}