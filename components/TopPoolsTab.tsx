'use client';

import { useState, useEffect } from 'react';
import { defiLlamaAPI } from '../lib/defillama-api';
import { analyzePoolHedges, generateHedgeSummary } from '../lib/hedge-detector';

interface Pool {
  pool: string;
  symbol: string;
  project: string;
  chain: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  volumeUsd1d: number;
  volumeUsd7d: number;
  historicalAvgApy?: number;
  fees?: number;
  daysLive?: number;
  // Hedge analysis fields
  hasHedges?: boolean;
  hedgeCount?: number;
  bestHedgeProtocol?: string;
  hedgeCoverage?: number;
  deltaNeutralPossible?: boolean;
}

export default function TopPoolsTab() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'apy' | 'tvl' | 'volume'>('apy');
  const [error, setError] = useState<string | null>(null);
  const [showOnlyDeltaNeutral, setShowOnlyDeltaNeutral] = useState(false);

  useEffect(() => {
    fetchTopPools();
  }, []);

  const fetchTopPools = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching top pools...');
      const yieldData = await defiLlamaAPI.getYieldPools();
      console.log('Yield data response:', yieldData);
      
      if (yieldData && yieldData.data && Array.isArray(yieldData.data)) {
        console.log(`Total pools received: ${yieldData.data.length}`);
        // Filter pools with TVL >= $1M and valid APY
        const filteredPools = yieldData.data.filter((pool: any) => 
          pool.tvlUsd >= 1000000 && 
          pool.apy > 0 && 
          pool.apy < 1000 && // Remove extreme outliers
          pool.symbol && 
          pool.project
        );

        console.log(`Filtered pools (TVL ≥ $1M): ${filteredPools.length}`);

        // Sort by APY and take top 100
        const topPools = filteredPools
          .sort((a: any, b: any) => b.apy - a.apy)
          .slice(0, 100);
          
        console.log(`Top 100 pools selected: ${topPools.length}`);

        // Calculate fees, days live, and enhance pool data
        const enrichedPools = topPools.map((pool: any) => {
          // Calculate estimated fees based on volume and typical fee rates
          let estimatedFees = 0;
          if (pool.volumeUsd1d && pool.volumeUsd1d > 0) {
            // Different fee structures for different protocols
            let feeRate = 0.003; // Default 0.3%
            if (pool.project === 'uniswap-v3') feeRate = 0.0025;
            else if (pool.project === 'sushiswap') feeRate = 0.003;
            else if (pool.project === 'raydium-amm') feeRate = 0.0025;
            else if (pool.project === 'orca-dex') feeRate = 0.003;
            else if (pool.poolMeta?.includes('0.01%')) feeRate = 0.0001;
            else if (pool.poolMeta?.includes('0.05%')) feeRate = 0.0005;
            else if (pool.poolMeta?.includes('0.3%')) feeRate = 0.003;
            else if (pool.poolMeta?.includes('1%')) feeRate = 0.01;
            
            estimatedFees = pool.volumeUsd1d * feeRate;
          }

          // Calculate days since pool went live (approximate based on data count)
          let daysLive = null;
          if (pool.count && pool.count > 0) {
            // Approximate: count represents daily data points, so count ≈ days live
            daysLive = pool.count;
          } else if (pool.apyBaseInception) {
            // Fallback: estimate based on inception data availability
            daysLive = 30; // Default estimate
          }

          // Analyze hedge availability for the pool
          const hedgeSummary = generateHedgeSummary(pool.symbol);

          return {
            pool: pool.pool,
            symbol: pool.symbol,
            project: pool.project,
            chain: pool.chain,
            tvlUsd: pool.tvlUsd,
            apy: pool.apy,
            apyBase: pool.apyBase || 0,
            apyReward: pool.apyReward || 0,
            volumeUsd1d: pool.volumeUsd1d || 0,
            volumeUsd7d: pool.volumeUsd7d || 0,
            historicalAvgApy: pool.apyMean30d || pool.apy, // Use 30d mean or current APY
            fees: estimatedFees,
            daysLive: daysLive,
            // Hedge analysis
            hasHedges: hedgeSummary.hasHedges,
            hedgeCount: hedgeSummary.hedgeCount,
            bestHedgeProtocol: hedgeSummary.bestProtocol,
            hedgeCoverage: hedgeSummary.coverage,
            deltaNeutralPossible: hedgeSummary.deltaNetural
          };
        });

        setPools(enrichedPools);
      } else {
        console.error('Invalid yield data structure:', yieldData);
        setError('No pool data available from API');
      }
    } catch (err) {
      console.error('Error fetching pools:', err);
      setError(`Failed to fetch pool data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter pools based on delta neutral selection
  const filteredPools = showOnlyDeltaNeutral 
    ? pools.filter(pool => pool.deltaNeutralPossible)
    : pools;

  const sortedPools = [...filteredPools].sort((a, b) => {
    switch (sortBy) {
      case 'apy':
        return b.apy - a.apy;
      case 'tvl':
        return b.tvlUsd - a.tvlUsd;
      case 'volume':
        return b.volumeUsd1d - a.volumeUsd1d;
      default:
        return b.apy - a.apy;
    }
  });

  const formatNumber = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00%';
    return `${value.toFixed(2)}%`;
  };

  const formatDaysLive = (days: number | null) => {
    if (!days || days <= 0) return 'N/A';
    return `${days}d`;
  };

  const getChainColor = (chain: string) => {
    switch(chain?.toLowerCase()) {
      case 'ethereum': return 'bg-blue-100 text-blue-800';
      case 'arbitrum': return 'bg-blue-200 text-blue-900';
      case 'optimism': return 'bg-red-100 text-red-800';
      case 'polygon': return 'bg-purple-100 text-purple-800';
      case 'base': return 'bg-indigo-100 text-indigo-800';
      case 'solana': return 'bg-green-100 text-green-800';
      case 'sui': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Top 100 Yield Pools {showOnlyDeltaNeutral && '(Delta Neutral CLM)'}
          </h2>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pools with TVL ≥ $1M, sorted by APY
            </p>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              {pools.filter(p => p.deltaNeutralPossible).length} delta neutral pools available
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOnlyDeltaNeutral(!showOnlyDeltaNeutral)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              showOnlyDeltaNeutral
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⚖️ Delta Neutral Only
          </button>
          <button
            onClick={() => setSortBy('apy')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'apy' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Sort by APY
          </button>
          <button
            onClick={() => setSortBy('tvl')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'tvl' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Sort by TVL
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'volume' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Sort by Volume
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  #
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pool
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Chain
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  APY
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg APY
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  TVL
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Volume 24H
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fees 24H
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Days Live
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Hedge Available
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPools.map((pool, idx) => (
                <tr key={pool.pool} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-2 py-1 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {pool.symbol}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {pool.project}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {pool.pool.substring(0, 8)}...
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getChainColor(pool.chain)}`}>
                      {pool.chain}
                    </span>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-right">
                    <div className="text-sm font-semibold text-green-600">
                      {formatPercent(pool.apy)}
                    </div>
                    {pool.apyReward > 0 && (
                      <div className="text-xs text-gray-500">
                        Base: {formatPercent(pool.apyBase)}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                    {formatPercent(pool.historicalAvgApy || 0)}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                    {formatNumber(pool.tvlUsd)}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                    {pool.volumeUsd1d > 0 ? formatNumber(pool.volumeUsd1d) : 'N/A'}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">
                    {pool.fees > 0 ? formatNumber(pool.fees) : 'N/A'}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-400">
                    {formatDaysLive(pool.daysLive)}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-center">
                    {pool.hasHedges ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        No
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {sortedPools.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No pools found matching criteria</p>
        </div>
      )}
    </div>
  );
}