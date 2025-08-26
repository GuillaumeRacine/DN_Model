'use client';

import { useState, useEffect } from 'react';
import { dataService } from '../lib/data-service';
import { useAppStore } from '../lib/store';
import { CHAIN_DISPLAY_NAMES } from '../lib/defillama-api';

export default function TopYieldPools() {
  const { selectedChains, minTvlFilter } = useAppStore();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'apy' | 'tvl'>('apy');

  useEffect(() => {
    fetchPools();
  }, [minTvlFilter, selectedChains]);

  const fetchPools = async () => {
    setLoading(true);
    try {
      const data = await dataService.getTopYieldPools(minTvlFilter);
      const filtered = data.filter((pool: any) => 
        selectedChains.includes(pool.chain?.toLowerCase())
      );
      setPools(filtered);
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedPools = [...pools].sort((a, b) => {
    if (sortBy === 'apy') return b.apy - a.apy;
    return b.tvlUsd - a.tvlUsd;
  });

  const formatNumber = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getRiskColor = (ilRisk: string) => {
    switch(ilRisk?.toLowerCase()) {
      case 'no': return 'text-green-600 bg-green-50';
      case 'low': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Top Yield Pools
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('apy')}
            className={`px-3 py-1 rounded ${
              sortBy === 'apy' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Sort by APY
          </button>
          <button
            onClick={() => setSortBy('tvl')}
            className={`px-3 py-1 rounded ${
              sortBy === 'tvl' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Sort by TVL
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pool
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Chain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                TVL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                APY
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Base APY
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                IL Risk
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Volume 7D
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedPools.map((pool, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {pool.symbol}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {pool.project}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {CHAIN_DISPLAY_NAMES[pool.chain] || pool.chain}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {formatNumber(pool.tvlUsd)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-green-600">
                    {pool.apy.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {pool.apyBase?.toFixed(2) || '0.00'}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(pool.ilRisk)}`}>
                    {pool.ilRisk || 'Unknown'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {pool.volumeUsd7d ? formatNumber(pool.volumeUsd7d) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}