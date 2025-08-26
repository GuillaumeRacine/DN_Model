'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '../lib/store';
import { dataService } from '../lib/data-service';
import { CHAIN_DISPLAY_NAMES, TARGET_CHAINS } from '../lib/defillama-api';
import ChainMetrics from '../components/ChainMetrics';
import PoolsList from '../components/PoolsList';
import TopYieldPools from '../components/TopYieldPools';
import ProtocolsList from '../components/ProtocolsList';

export default function Dashboard() {
  const { viewMode, setViewMode, selectedChains, toggleChain } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [viewMode, selectedChains]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const metrics = await dataService.getPoolMetrics();
      setData(metrics);
    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTVL = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              DN_Model
            </h1>
            <div className="flex space-x-4">
              <button
                onClick={() => fetchData()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 h-12 items-center">
            {['overview', 'chain', 'yields', 'protocol'].map((mode) => (
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
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Filter by Chain:
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TARGET_CHAINS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => toggleChain(value)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedChains.includes(value)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {CHAIN_DISPLAY_NAMES[value]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        ) : (
          <div>
            {data && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total TVL
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {formatTVL(data.totalTvl)}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Active Chains
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {selectedChains.length}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Protocols
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {data.topProtocols?.length || 0}
                  </p>
                </div>
              </div>
            )}

            {viewMode === 'overview' && data && (
              <ChainMetrics data={data} />
            )}
            
            {viewMode === 'chain' && data && (
              <ChainMetrics data={data} detailed />
            )}
            
            {viewMode === 'yields' && (
              <TopYieldPools />
            )}
            
            {viewMode === 'protocol' && data && (
              <ProtocolsList protocols={data.topProtocols} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}