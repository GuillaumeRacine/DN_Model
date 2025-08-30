'use client';

import React, { useState, useEffect } from 'react';
// Fetch server-side yields to ensure accurate, timely data without exposing credentials
import { useAppStore } from '../lib/store';
import RefreshStatus from './RefreshStatus';
import PoolDetailsExpanded from './PoolDetailsExpanded';

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
  // Analytics metrics from our database
  fvr?: number;
  volatility30d?: number;
  ilRiskScore?: number;
  recommendation?: string;
  dataPoints?: number;
  // Additional fields for expanded view
  poolMeta?: string;
  apyMean30d?: number;
  apyPct1D?: number;
  apyPct7D?: number;
  apyPct30D?: number;
  il7d?: number;
  ilRisk?: string;
  stablecoin?: boolean;
  exposure?: string;
  mu?: number;
  sigma?: number;
  count?: number;
  outlier?: boolean;
  underlyingTokens?: string[];
  rewardTokens?: string[];
  predictions?: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: string;
  };
  apyBase7d?: number;
  apyBaseInception?: number;
}

export default function TopPoolsTab() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [yieldsUpdatedAt, setYieldsUpdatedAt] = useState<string | null>(null);
  const [yieldsSource, setYieldsSource] = useState<string | null>(null);
  const [ageLoaded, setAgeLoaded] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'apy' | 'tvl' | 'volume'>('volume');
  const [error, setError] = useState<string | null>(null);
  const [expandedPool, setExpandedPool] = useState<string | null>(null);
  
  const { setLastRefreshTime } = useAppStore();

  useEffect(() => {
    fetchTopPools();
  }, []);

  const fetchAnalyticsData = async (): Promise<Map<string, any>> => {
    try {
      console.log('Fetching analytics data...');
      const response = await fetch('/api/pool-analytics?limit=200&minTVL=100000');
      const analyticsData = await response.json();
      
      if (analyticsData.success && analyticsData.data) {
        // Create a map keyed by token_pair for fast lookup
        const analyticsMap = new Map();
        const normalize = (pair: string | undefined) => {
          if (!pair) return '';
          const parts = pair
            .replace(/\d+\.\d+%/g, '')
            .split(/[\/:\-]/)
            .map((t: string) => t.trim().toUpperCase())
            .filter(Boolean)
            .sort();
          return parts.join('-');
        };
        analyticsData.data.forEach((item: any) => {
          const key = normalize(item.token_pair);
          analyticsMap.set(key, {
            fvr: item.fvr,
            volatility30d: item.volatility_30d,
            ilRiskScore: item.il_risk_score,
            recommendation: item.recommendation,
            dataPoints: item.data_points_count
          });
        });
        console.log(`Loaded analytics for ${analyticsMap.size} pools`);
        return analyticsMap;
      }
    } catch (error) {
      console.warn('Analytics data fetch failed:', error);
    }
    return new Map();
  };

  const fetchTopPools = async () => {
    setLoading(true);
    setError(null);
    try {
      const refreshStart = new Date();
      console.log('Fetching top pools (live yields + analytics overlay)...');

      const [yieldsRes, analyticsMap] = await Promise.all([
        fetch('/api/yields?limit=500&minTVL=1000000').then(r => r.json()),
        fetchAnalyticsData()
      ]);

      // Update global refresh time
      setLastRefreshTime(refreshStart);
      console.log('Yields received:', yieldsRes?.data?.length || 0, 'analytics items:', analyticsMap.size);
      setYieldsUpdatedAt(yieldsRes?.updatedAt || null);
      setYieldsSource(yieldsRes?.source || null);

      if (!yieldsRes || !Array.isArray(yieldsRes.data)) {
        throw new Error('Failed to fetch yields');
      }

      // Filter and sort by 24h volume (descending) to build the canonical top-100 list
      const topPoolsRaw = yieldsRes.data
        .filter((pool: any) => pool.tvlUsd >= 1_000_000 && pool.apy > 0 && pool.apy < 1000)
        .map((p: any) => ({ ...p, volumeUsd1d: p.volumeUsd1d || 0 }))
        .sort((a: any, b: any) => (b.volumeUsd1d || 0) - (a.volumeUsd1d || 0))
        .slice(0, 100);

      // Overlay analytics by token_pair symbol key
      const enrichedPools = topPoolsRaw.map((pool: any) => {
        // Estimate fees based on typical fee rates
        let feeRate = 0.003;
        const meta = pool.poolMeta?.toLowerCase?.() || '';
        if (meta.includes('0.01%')) feeRate = 0.0001;
        else if (meta.includes('0.05%')) feeRate = 0.0005;
        else if (meta.includes('0.3%')) feeRate = 0.003;
        else if (meta.includes('1%')) feeRate = 0.01;

        const estimatedFees = (pool.volumeUsd1d || 0) * feeRate;

        const normalize = (sym: string | undefined) => {
          if (!sym) return '';
          const pair = sym.replace(/\d+\.\d+%/g, '')
            .split(/[\/:\-]/)
            .map((t: string) => t.trim().toUpperCase())
            .filter(Boolean)
            .sort()
            .join('-');
          return pair;
        };
        const symbolKey = normalize(pool.symbol);
        const analytics = analyticsMap.get(symbolKey);

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
          historicalAvgApy: pool.apyMean30d || pool.apy,
          fees: estimatedFees,
          daysLive: pool.count || pool.age || 
            (pool.apyBaseInception
              ? Math.max(1, Math.floor((Date.now() - (pool.apyBaseInception * 1000)) / (1000 * 60 * 60 * 24)))
              : (pool.inception
                  ? Math.max(1, Math.floor((Date.now() - (pool.inception * 1000)) / (1000 * 60 * 60 * 24)))
                  : (pool.listedAt 
                      ? Math.max(1, Math.floor((Date.now() - (pool.listedAt * 1000)) / (1000 * 60 * 60 * 24)))
                      : null))),
          fvr: analytics?.fvr,
          volatility30d: analytics?.volatility30d,
          ilRiskScore: analytics?.ilRiskScore,
          recommendation: analytics?.recommendation,
          dataPoints: analytics?.dataPoints,
          // Additional fields from API for expanded view
          poolMeta: pool.poolMeta,
          apyMean30d: pool.apyMean30d,
          apyPct1D: pool.apyPct1D,
          apyPct7D: pool.apyPct7D,
          apyPct30D: pool.apyPct30D,
          il7d: pool.il7d,
          ilRisk: pool.ilRisk,
          stablecoin: pool.stablecoin,
          exposure: pool.exposure,
          mu: pool.mu,
          sigma: pool.sigma,
          count: pool.count,
          outlier: pool.outlier,
          underlyingTokens: pool.underlyingTokens,
          rewardTokens: pool.rewardTokens,
          predictions: pool.predictions,
          apyBase7d: pool.apyBase7d,
          apyBaseInception: pool.apyBaseInception
        } as Pool;
      });

      setPools(enrichedPools);

      // Fill missing ages using cached server endpoint (hourly cache)
      const needAge = enrichedPools.filter((p: Pool) => !p.daysLive || p.daysLive <= 0).map((p) => p.pool);
      if (needAge.length > 0) {
        const batches: string[][] = [];
        for (let i = 0; i < needAge.length; i += 25) {
          batches.push(needAge.slice(i, i + 25));
        }
        let updated = 0;
        for (const batch of batches) {
          try {
            const res = await fetch(`/api/pool-ages?ids=${encodeURIComponent(batch.join(','))}`);
            const json = await res.json();
            if (json?.success && json.ages) {
              setPools((prev) => prev.map((p) => {
                const age = json.ages[p.pool];
                if (typeof age === 'number' && age > 0) return { ...p, daysLive: age };
                return p;
              }));
              updated += batch.length;
              setAgeLoaded(updated);
            }
          } catch {
            // fallback only for this batch
            await populatePoolAgesFromSeries(batch);
          }
        }
      }

    } catch (err) {
      console.error('Error fetching pools:', err);
      setError(`Failed to fetch pool data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const populatePoolAgesFromSeries = async (poolIds: string[]) => {
    const maxConcurrent = 8;
    let index = 0;
    let completed = 0;

    const worker = async () => {
      while (index < poolIds.length) {
        const i = index++;
        const poolId = poolIds[i];
        try {
          const res = await fetch(`/api/pool-series?pool=${encodeURIComponent(poolId)}`);
          const json = await res.json();
          const points = json?.data?.data;
          if (Array.isArray(points) && points.length > 0) {
            const first = points[0];
            const ts = (typeof first?.timestamp === 'number') ? first.timestamp : null;
            if (ts) {
              const days = Math.max(1, Math.floor((Date.now() - (ts * 1000)) / (1000 * 60 * 60 * 24)));
              setPools((prev) => prev.map((p) => p.pool === poolId ? { ...p, daysLive: days } : p));
            }
          }
        } catch {
          // ignore
        } finally {
          completed++;
          setAgeLoaded(completed);
        }
      }
    };

    const workers = Array.from({ length: Math.min(maxConcurrent, poolIds.length) }, () => worker());
    await Promise.all(workers);
  };

  // Use all pools without filtering
  const filteredPools = pools;

  const sortedPools = [...filteredPools].sort((a, b) => {
    switch (sortBy) {
      case 'apy':
        return b.apy - a.apy;
      case 'tvl':
        return b.tvlUsd - a.tvlUsd;
      case 'volume':
        return b.volumeUsd1d - a.volumeUsd1d;
      default:
        return b.volumeUsd1d - a.volumeUsd1d;
    }
  });

  const formatNumber = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (!isFinite(value) || value < 0 || value > 1000) return 'N/A';
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
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Top Yield Pools
          </h2>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSortBy('apy')}
            className={`px-2 py-1 rounded text-xs ${
              sortBy === 'apy' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            APY
          </button>
          <button
            onClick={() => setSortBy('tvl')}
            className={`px-2 py-1 rounded text-xs ${
              sortBy === 'tvl' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            TVL
          </button>
          <button
            onClick={() => setSortBy('volume')}
            className={`px-2 py-1 rounded text-xs ${
              sortBy === 'volume' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Volume
          </button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                  #
                </th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                  Pool
                </th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                  Chain
                </th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                  APY
                </th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                  Avg APY
                </th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                  TVL
                </th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                  Volume 24H
                </th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                  Fees 24H
                </th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Days</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">FVR</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Vol 30d</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Risk</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Signal</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {sortedPools.map((pool, idx) => (
                <React.Fragment key={pool.pool}>
                <tr 
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => setExpandedPool(expandedPool === pool.pool ? null : pool.pool)}
                >
                  <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                    {idx + 1}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900 dark:text-white">
                      {pool.symbol}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {pool.project}
                    </div>
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {pool.chain}
                    </span>
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-right">
                    <div className="text-xs font-medium text-green-600">
                      {formatPercent(pool.apy)}
                    </div>
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs text-gray-600 dark:text-gray-400">
                    {formatPercent(pool.historicalAvgApy || 0)}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium text-gray-900 dark:text-white">
                    {formatNumber(pool.tvlUsd)}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs text-gray-600 dark:text-gray-400">
                    {pool.volumeUsd1d > 0 ? formatNumber(pool.volumeUsd1d) : '-'}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs text-gray-600 dark:text-gray-400">
                    {(pool.fees || 0) > 0 ? formatNumber(pool.fees || 0) : '-'}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-center text-xs text-gray-600 dark:text-gray-400">{formatDaysLive(pool.daysLive || null)}</td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium">
                    {pool.fvr ? (
                      <span className={`${
                        pool.fvr >= 1.0 ? 'text-green-600' : 
                        pool.fvr >= 0.6 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {pool.fvr.toFixed(2)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs text-gray-600 dark:text-gray-400">
                    {pool.volatility30d ? `${(pool.volatility30d * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-center text-xs">
                    {pool.ilRiskScore ? (
                      <span className={`px-1 rounded text-xs ${
                        pool.ilRiskScore <= 3 ? 'bg-green-100 text-green-800' :
                        pool.ilRiskScore <= 6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {pool.ilRiskScore}/10
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-center text-xs">
                    {pool.recommendation === 'attractive' && '🟢'}
                    {pool.recommendation === 'fair' && '🟡'}
                    {pool.recommendation === 'overpriced' && '🔴'}
                    {!pool.recommendation && '-'}
                  </td>
                </tr>
                <PoolDetailsExpanded
                  pool={pool}
                  isExpanded={expandedPool === pool.pool}
                  onToggle={() => setExpandedPool(expandedPool === pool.pool ? null : pool.pool)}
                />
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-2 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
          <span>
            Data source: {yieldsSource || 'Unknown'}
          </span>
          <span>
            Last updated: {yieldsUpdatedAt ? new Date(yieldsUpdatedAt).toLocaleString() : 'N/A'}
          </span>
        </div>
        <div className="px-2 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex justify-end">
          <span>Age populated: {ageLoaded}/{pools.filter(p => !p.daysLive || p.daysLive <= 0).length + ageLoaded}</span>
        </div>
      </div>
      
      {sortedPools.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No pools found matching criteria</p>
        </div>
      )}
      
      {/* Refresh Status */}
      <RefreshStatus showNextRefresh={true} />
    </div>
  );
}
