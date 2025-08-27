'use client';

import { useState } from 'react';
import { useAppStore } from '../lib/store';
import TopPoolsTab from '../components/TopPoolsTab';
import PerpetualTab from '../components/PerpetualTab';
import SimplifiedHome from '../components/SimplifiedHome';
// import PositionMonitor from '../components/PositionMonitor';
// import SolanaPositionMonitor from '../components/SolanaPositionMonitor';
// import WalletPortfolioTracker from '../components/WalletPortfolioTracker';
// import SimplifiedPositionChecker from '../components/SimplifiedPositionChecker';
// import CoinStatsWalletTracker from '../components/CoinStatsWallet';
import CLMPositionDashboard from '../components/CLMPositionDashboard';

export default function Dashboard() {
  const { viewMode, setViewMode } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      <nav className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 h-12 items-center">
            {['home', 'pools', 'perps', 'dn model'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`capitalize px-3 py-2 text-sm font-medium rounded-md ${
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {viewMode === 'home' && <SimplifiedHome />}
        {viewMode === 'pools' && <TopPoolsTab />}
        {viewMode === 'perps' && <PerpetualTab />}
        {viewMode === 'dn model' && <CLMPositionDashboard />}
      </div>
    </div>
  );
}