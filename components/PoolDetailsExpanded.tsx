'use client';

import { useState, useEffect } from 'react';
import PoolPriceChart from './PoolPriceChart';

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

interface PoolDetailsProps {
  pool: Pool;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function PoolDetailsExpanded({ pool, isExpanded, onToggle }: PoolDetailsProps) {
  const [historicalAvgAPY, setHistoricalAvgAPY] = useState<number | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  // Calculate true inception-to-present average APY from time series
  const calculateHistoricalAverage = async (poolId: string) => {
    try {
      setIsLoadingHistorical(true);
      const response = await fetch(`/api/pool-series?pool=${encodeURIComponent(poolId)}`);
      const json = await response.json();
      
      if (json.success && json.data?.data) {
        const timeSeries = json.data.data;
        if (Array.isArray(timeSeries) && timeSeries.length > 0) {
          // Calculate average APY across entire time series
          const validApyValues = timeSeries
            .filter(point => typeof point.apy === 'number' && point.apy > 0 && point.apy < 1000)
            .map(point => point.apy);
          
          if (validApyValues.length > 0) {
            const avgAPY = validApyValues.reduce((sum, apy) => sum + apy, 0) / validApyValues.length;
            setHistoricalAvgAPY(avgAPY);
            console.log(`📊 Historical average for ${poolId}: ${avgAPY.toFixed(2)}% (${validApyValues.length} data points)`);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch historical data for ${poolId}:`, error);
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  // Fetch historical data when component expands
  useEffect(() => {
    if (isExpanded && !historicalAvgAPY && !isLoadingHistorical) {
      calculateHistoricalAverage(pool.pool);
    }
  }, [isExpanded, pool.pool, historicalAvgAPY, isLoadingHistorical]);

  if (!isExpanded) return null;

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    if (isNaN(value) || !isFinite(value) || value < 0 || value > 1000) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  // Helper function to check if a value should be hidden
  const shouldHideValue = (value: any) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      // Don't hide "Loading..." text
      if (lowerValue.includes('loading')) return false;
      return lowerValue === 'n/a' || lowerValue === 'nan' || value.trim() === '' || value === '-';
    }
    if (typeof value === 'number') {
      return isNaN(value) || !isFinite(value);
    }
    return false;
  };

  // Filter function to remove N/A, NaN, and empty values
  const filterMetrics = (metricsObj: Record<string, any>) => {
    const filtered: Record<string, any> = {};
    Object.entries(metricsObj).forEach(([key, value]) => {
      if (!shouldHideValue(value)) {
        filtered[key] = value;
      }
    });
    return filtered;
  };

  // Only show 3 cards as requested
  const allMetrics = {
    '📊 Core Metrics': {
      'Pool ID': pool.pool,
      'Protocol': pool.project,
      'Chain': pool.chain,
      'Symbol': pool.symbol,
      'Days Live': pool.daysLive ? `${pool.daysLive} days` : null,
      'Pool Meta': pool.poolMeta,
    },
    '💰 Financial Metrics': {
      'TVL': `$${formatNumber(pool.tvlUsd)}`,
      'Volume 24H': pool.volumeUsd1d ? `$${formatNumber(pool.volumeUsd1d)}` : null,
      'Volume 7D': pool.volumeUsd7d ? `$${formatNumber(pool.volumeUsd7d)}` : null,
      'Estimated Fees 24H': pool.fees ? `$${formatNumber(pool.fees)}` : null,
    },
    '📈 Yield Metrics': {
      'Current APY': formatPercent(pool.apy),
      'Base APY': formatPercent(pool.apyBase),
      'Reward APY': pool.apyReward ? formatPercent(pool.apyReward) : null,
      '30D Average APY': pool.apyMean30d ? formatPercent(pool.apyMean30d) : null,
      'Inception Avg APY': isLoadingHistorical ? 'Loading...' : 
        (historicalAvgAPY ? formatPercent(historicalAvgAPY) : null),
    },
  };

  // Filter out N/A values for each card
  const metrics = {
    '📊 Core Metrics': filterMetrics(allMetrics['📊 Core Metrics']),
    '💰 Financial Metrics': filterMetrics(allMetrics['💰 Financial Metrics']),
    '📈 Yield Metrics': filterMetrics(allMetrics['📈 Yield Metrics']),
  };

  return (
    <tr>
      <td colSpan={13} className="px-2 py-3 bg-gray-50 dark:bg-gray-800">
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(metrics).map(([category, items]) => (
              <div key={category} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                <div className="space-y-1">
                  {Object.entries(items).map(([label, value]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{label}:</span>
                      <span className="text-gray-900 dark:text-white font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Price Chart */}
          <div className="mt-6">
            <PoolPriceChart poolId={pool.pool} poolSymbol={pool.symbol} />
          </div>
          
          {/* Additional actions */}
          <div className="flex justify-end space-x-2 pt-2">
            <button 
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => window.open(`https://defillama.com/yields/pool/${pool.pool}`, '_blank')}
            >
              View on DeFiLlama →
            </button>
            <button 
              className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
              onClick={onToggle}
            >
              Close Details
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}