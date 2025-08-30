'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartDataPoint {
  timestamp: string;
  date: string;
  apy: number;
  apyBase: number;
  apyReward: number;
  tvlUsd: number;
  tvlUsdM: number; // TVL in millions for display
  il7d: number;
}

interface PoolPriceChartProps {
  poolId: string;
  poolSymbol: string;
}

export default function PoolPriceChart({ poolId, poolSymbol }: PoolPriceChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('90d');
  const [chartType] = useState<'multi'>('multi');

  const fetchChartData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/pool-series?pool=${encodeURIComponent(poolId)}`);
      const json = await response.json();
      
      if (!json.success || !json.data?.data) {
        throw new Error('Failed to fetch chart data');
      }

      const timeSeries = json.data.data;
      if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
        throw new Error('No chart data available');
      }

      // Process and filter data based on time range
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (timeRange) {
        case '30d':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        case '1y':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'all':
          cutoffDate.setFullYear(2020); // Show all data
          break;
      }

      const processedData = timeSeries
        .filter((point: any) => {
          const pointDate = new Date(point.timestamp);
          return pointDate >= cutoffDate && typeof point.apy === 'number' && point.apy > 0;
        })
        .map((point: any) => ({
          timestamp: point.timestamp,
          date: new Date(point.timestamp).toLocaleDateString(),
          apy: Number(point.apy.toFixed(2)),
          apyBase: Number((point.apyBase || 0).toFixed(2)),
          apyReward: Number((point.apyReward || 0).toFixed(2)),
          tvlUsd: point.tvlUsd || 0,
          tvlUsdM: Number(((point.tvlUsd || 0) / 1000000).toFixed(2)),
          il7d: Number((point.il7d || 0).toFixed(4))
        }))
        .sort((a: ChartDataPoint, b: ChartDataPoint) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      setChartData(processedData);
      console.log(`📈 Chart data loaded: ${processedData.length} points for ${poolSymbol}`);

    } catch (err) {
      console.error('Chart data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [poolId, timeRange]);

  // Calculate optimized Y-axis domains for better readability
  const getApyDomain = () => {
    if (chartData.length === 0) return ['dataMin - 5', 'dataMax + 5'];
    
    const apyValues = chartData.map(d => d.apy);
    const minApy = Math.min(...apyValues);
    const maxApy = Math.max(...apyValues);
    const range = maxApy - minApy;
    const padding = Math.max(range * 0.1, 5); // 10% padding or min 5 points
    
    return [Math.max(0, minApy - padding), maxApy + padding];
  };

  const getTvlDomain = () => {
    if (chartData.length === 0) return ['dataMin * 0.95', 'dataMax * 1.05'];
    
    const tvlValues = chartData.map(d => d.tvlUsdM);
    const minTvl = Math.min(...tvlValues);
    const maxTvl = Math.max(...tvlValues);
    const range = maxTvl - minTvl;
    const padding = range * 0.05; // 5% padding
    
    return [Math.max(0, minTvl - padding), maxTvl + padding];
  };

  const formatTooltip = (value: any, name: string) => {
    switch (name) {
      case 'apy':
      case 'apyBase':
      case 'apyReward':
        return [`${value}%`, name === 'apy' ? 'Total APY' : name === 'apyBase' ? 'Base APY' : 'Reward APY'];
      case 'tvlUsdM':
        return [`$${value}M`, 'TVL'];
      case 'il7d':
        return [`${(value * 100).toFixed(2)}%`, '7d IL'];
      default:
        return [value, name];
    }
  };

  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: timeRange === '1y' || timeRange === 'all' ? '2-digit' : undefined 
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-red-50 dark:bg-red-900 rounded-lg border border-red-200 dark:border-red-700">
        <div className="text-center">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load chart</p>
          <p className="text-xs text-red-500 dark:text-red-500 mt-1">{error}</p>
          <button 
            onClick={fetchChartData}
            className="mt-2 px-3 py-1 text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">No chart data available</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Chart Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            APY & TVL Performance - {poolSymbol}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {chartData.length} data points • Last {timeRange}
          </p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex space-x-1">
          {(['30d', '90d', '1y', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 text-xs rounded ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-64 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={formatXAxisLabel}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 10 }}
              domain={getApyDomain()}
              scale="linear"
              allowDecimals={true}
              label={{ 
                value: 'APY (%)', 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }}
              domain={getTvlDomain()}
              scale="linear"
              allowDecimals={true}
              label={{ 
                value: 'TVL ($M)', 
                angle: 90, 
                position: 'insideRight' 
              }}
            />
            <Tooltip 
              formatter={formatTooltip}
              labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            <Legend />
            
            {/* APY & TVL Multi-Chart */}
            <Line
              type="monotone"
              dataKey="apy"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              name="APY (%)"
              yAxisId="left"
            />
            <Line
              type="monotone"
              dataKey="tvlUsdM"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="TVL ($M)"
              yAxisId="right"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}