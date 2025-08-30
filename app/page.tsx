'use client';

import { useAppStore } from '../lib/store';
import TopPoolsTab from '../components/TopPoolsTab';
import SimplifiedHome from '../components/SimplifiedHome';
import CLMPositionDashboard from '../components/CLMPositionDashboard';
import EndpointsTab from '../components/EndpointsTab';

export default function Dashboard() {
  const { viewMode, setViewMode } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      <nav className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4">
          <div className="flex space-x-4 h-10 items-center">
            {['home', 'pools', 'dn model'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`capitalize px-2 py-1 text-xs font-medium rounded ${
                  viewMode === mode
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 py-2">

        {viewMode === 'home' && <SimplifiedHome />}
        {viewMode === 'pools' && <TopPoolsTab />}
        {viewMode === 'dn model' && <CLMPositionDashboard />}
        {viewMode === 'endpoints' && <EndpointsTab />}
        
        {/* Footer with endpoints link */}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-center">
            <button
              onClick={() => setViewMode('endpoints')}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              API Endpoints Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
