'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '../lib/store';
import RefreshStatus from './RefreshStatus';

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
  fvr?: number;
  volatility30d?: number;
  ilRiskScore?: number;
  recommendation?: string;
  dataPoints?: number;
}

export default function FVRPoolsTab() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [seriesLoaded, setSeriesLoaded] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'fvr' | 'apy' | 'tvl' | 'volume'>('volume');
  const [error, setError] = useState<string | null>(null);
  const [yieldsUpdatedAt, setYieldsUpdatedAt] = useState<string | null>(null);
  const [yieldsSource, setYieldsSource] = useState<string | null>(null);

  const { setLastRefreshTime } = useAppStore();

  useEffect(() => {
    fetchTopPools();
  }, []);

  const fetchAnalyticsData = async (): Promise<Map<string, any>> => {
    try {
      const response = await fetch('/api/pool-analytics?limit=200&minTVL=1000000');
      const analyticsData = await response.json();
      if (analyticsData.success && analyticsData.data) {
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
      const [yieldsRes, analyticsMap] = await Promise.all([
        fetch('/api/yields?limit=500&minTVL=1000000').then(r => r.json()),
        fetchAnalyticsData()
      ]);

      setLastRefreshTime(refreshStart);
      setYieldsUpdatedAt(yieldsRes?.updatedAt || null);
      setYieldsSource(yieldsRes?.source || null);

      if (!yieldsRes || !Array.isArray(yieldsRes.data)) {
        throw new Error('Failed to fetch yields');
      }

      const topPoolsRaw = yieldsRes.data
        .filter((pool: any) => pool.tvlUsd >= 1_000_000 && pool.apy > 0 && pool.apy < 1000)
        .map((p: any) => ({ ...p, volumeUsd1d: p.volumeUsd1d || 0 }))
        .sort((a: any, b: any) => (b.volumeUsd1d || 0) - (a.volumeUsd1d || 0))
        .slice(0, 100);

      const enrichedPools = topPoolsRaw.map((pool: any) => {
        let feeRate = 0.003;
        const meta = pool.poolMeta?.toLowerCase?.() || '';
        if (meta.includes('0.01%')) feeRate = 0.0001;
        else if (meta.includes('0.05%')) feeRate = 0.0005;
        else if (meta.includes('0.3%')) feeRate = 0.003;
        else if (meta.includes('1%')) feeRate = 0.01;
        const estimatedFees = (pool.volumeUsd1d || 0) * feeRate;
        const normalize = (sym: string | undefined) => {
          if (!sym) return '';
          const parts = sym
            .replace(/\d+\.\d+%/g, '')
            .split(/[\/:\-]/)
            .map((t: string) => t.trim().toUpperCase())
            .filter(Boolean)
            .sort();
          return parts.join('-');
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
          daysLive: pool.count || (pool.apyBaseInception ? Math.max(1, Math.floor((Date.now() - (pool.apyBaseInception * 1000)) / (1000 * 60 * 60 * 24))) : null),
          fvr: analytics?.fvr,
          volatility30d: analytics?.volatility30d,
          ilRiskScore: analytics?.ilRiskScore,
          recommendation: analytics?.recommendation,
          dataPoints: analytics?.dataPoints
        } as Pool;
      });

      setPools(enrichedPools);

      // Populate 30d time series per pool (with modest concurrency)
      await populateThirtyDaySeries(enrichedPools.map(p => p.pool));

    } catch (err) {
      console.error('Error fetching pools:', err);
      setError(`Failed to fetch pool data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch 30d series for the displayed pools to populate analytics context
  const populateThirtyDaySeries = async (poolIds: string[]) => {
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
          // Optionally compute 30d average APY from series and merge into pools
          if (json?.data?.data && Array.isArray(json.data.data)) {
            const points = json.data.data as any[];
            // Heuristics: look for fields apy or apyMean; fallback to value
            const recent = points.slice(-30);
            const apys = recent
              .map((p: any) => (typeof p.apy === 'number' ? p.apy : (typeof p.value === 'number' ? p.value : null)))
              .filter((v: any) => typeof v === 'number');
            if (apys.length > 0) {
              const avg = apys.reduce((a: number, b: number) => a + b, 0) / apys.length;
              // Compute a simple volatility proxy from APY changes (fallback when analytics missing)
              let vol: number | undefined = undefined;
              if (apys.length > 1) {
                const changes: number[] = [];
                for (let k = 1; k < apys.length; k++) {
                  const prev = apys[k - 1];
                  const curr = apys[k];
                  if (prev && curr) {
                    const ch = (curr - prev) / Math.max(1e-9, prev);
                    if (isFinite(ch)) changes.push(ch);
                  }
                }
                if (changes.length > 1) {
                  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
                  const variance = changes.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (changes.length - 1);
                  vol = Math.sqrt(Math.max(0, variance));
                }
              }
              setPools(prev => prev.map(pl => {
                if (pl.pool !== poolId) return pl;
                const existingVol = pl.volatility30d;
                const useVol = typeof existingVol === 'number' ? existingVol : (typeof vol === 'number' ? vol : undefined);
                const fvr = (typeof useVol === 'number' && useVol > 0) ? (pl.apy / (useVol * 100)) : pl.fvr; // scale proxy
                return { ...pl, historicalAvgApy: avg, volatility30d: useVol ?? pl.volatility30d, fvr: fvr ?? pl.fvr };
              }));
            }
          }
        } catch {
          // ignore series errors to avoid blocking UI
        } finally {
          completed++;
          setSeriesLoaded(completed);
        }
      }
    };

    const workers = Array.from({ length: Math.min(maxConcurrent, poolIds.length) }, () => worker());
    await Promise.all(workers);
  };

  const filteredPools = pools;
  const sortedPools = [...filteredPools].sort((a, b) => {
    switch (sortBy) {
      case 'fvr': {
        const fb = typeof b.fvr === 'number' ? b.fvr : -Infinity;
        const fa = typeof a.fvr === 'number' ? a.fvr : -Infinity;
        if (fb !== fa) return fb - fa;
        return b.volumeUsd1d - a.volumeUsd1d;
      }
      case 'apy': return b.apy - a.apy;
      case 'tvl': return b.tvlUsd - a.tvlUsd;
      case 'volume': return b.volumeUsd1d - a.volumeUsd1d;
      default: return b.volumeUsd1d - a.volumeUsd1d;
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">FVR Analytics</h2>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setSortBy('apy')} className={`px-2 py-1 rounded text-xs ${sortBy === 'apy' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>APY</button>
          <button onClick={() => setSortBy('tvl')} className={`px-2 py-1 rounded text-xs ${sortBy === 'tvl' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>TVL</button>
          <button onClick={() => setSortBy('volume')} className={`px-2 py-1 rounded text-xs ${sortBy === 'volume' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Volume</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">#</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Pool</th>
                <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Chain</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">APY</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">FVR</th>
                <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Vol 30d</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Risk</th>
                <th className="px-1 py-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">Signal</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {sortedPools.map((pool, idx) => (
                <tr key={pool.pool} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-1 py-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">{idx + 1}</td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900 dark:text-white">{pool.symbol}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{pool.project}</div>
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap"><span className="text-xs text-gray-600 dark:text-gray-400">{pool.chain}</span></td>
                  <td className="px-1 py-1 whitespace-nowrap text-right"><div className="text-xs font-medium text-green-600">{formatPercent(pool.apy)}</div></td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium">
                    {pool.fvr ? (
                      <span className={`${pool.fvr >= 1.0 ? 'text-green-600' : pool.fvr >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>{pool.fvr.toFixed(2)}</span>
                    ) : '-'}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-right text-xs text-gray-600 dark:text-gray-400">{pool.volatility30d ? `${(pool.volatility30d * 100).toFixed(1)}%` : '-'}</td>
                  <td className="px-1 py-1 whitespace-nowrap text-center text-xs">
                    {pool.ilRiskScore ? (
                      <span className={`px-1 rounded text-xs ${pool.ilRiskScore <= 3 ? 'bg-green-100 text-green-800' : pool.ilRiskScore <= 6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{pool.ilRiskScore}/10</span>
                    ) : '-'}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-center text-xs">
                    {pool.recommendation === 'attractive' && '🟢'}
                    {pool.recommendation === 'fair' && '🟡'}
                    {pool.recommendation === 'overpriced' && '🔴'}
                    {!pool.recommendation && '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-2 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
          <span>Data source: {yieldsSource || 'Unknown'}</span>
          <span>Last updated: {yieldsUpdatedAt ? new Date(yieldsUpdatedAt).toLocaleString() : 'N/A'} (series loaded: {seriesLoaded}/{pools.length})</span>
        </div>
      </div>

      <RefreshStatus showNextRefresh={true} />
    </div>
  );
}
