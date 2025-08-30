'use client';

import { useState, useEffect } from 'react';
import { defiLlamaAPI } from '../lib/defillama-api';
import { useAppStore } from '../lib/store';
import RefreshStatus from './RefreshStatus';

interface TokenData {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  change24h?: number;
  change7d?: number;
  change30d?: number;
  activeUsers?: number;
  cagr1y?: number;
  cagr2y?: number;
  cagr3y?: number | null;
  cagr4y?: number | null;
  cagr5y?: number | null;
}

interface ETFData {
  token: string;
  tokenName: string;
  totalETFs: number;
  aggregateInflow24h: number;
  aggregateInflow7d: number;
  totalAUM: number;
  percentOfTotalSupply: number;
  totalSupply: number;
  inflowTrend: 'accelerating' | 'decelerating' | 'stable';
}

export default function SimplifiedHome() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [etfData, setETFData] = useState<ETFData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'cagr' | 'etf'>('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const { setLastRefreshTime } = useAppStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const refreshStart = new Date();
      
      // Fetch token prices and market caps
      const tokenIds = [
        'coingecko:bitcoin',
        'coingecko:ethereum', 
        'coingecko:solana',
        'coingecko:sui'
      ];

      const pricesData = await defiLlamaAPI.getCurrentPrices(tokenIds);
      
      // Update global refresh time
      setLastRefreshTime(refreshStart);

      // Process token data with historical CAGR and user metrics
      const tokenData: TokenData[] = [
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          price: pricesData.coins?.['coingecko:bitcoin']?.price,
          marketCap: pricesData.coins?.['coingecko:bitcoin']?.mcap,
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          price: pricesData.coins?.['coingecko:ethereum']?.price,
          marketCap: pricesData.coins?.['coingecko:ethereum']?.mcap,
        },
        {
          symbol: 'SOL',
          name: 'Solana',
          price: pricesData.coins?.['coingecko:solana']?.price,
          marketCap: pricesData.coins?.['coingecko:solana']?.mcap,
        },
        {
          symbol: 'SUI',
          name: 'Sui',
          price: pricesData.coins?.['coingecko:sui']?.price,
          marketCap: pricesData.coins?.['coingecko:sui']?.mcap,
        },
      ];
      setTokens(tokenData);

      // No ETF data source configured → leave empty to avoid mock data
      setETFData([]);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return 'N/A';
    if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const formatMarketCap = (marketCap?: number) => {
    if (marketCap === undefined || marketCap === null) return 'N/A';
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toFixed(0)}`;
  };


  const formatInflow = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    const absValue = Math.abs(value);
    if (absValue >= 1e9) return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
    if (absValue >= 1e6) return `${sign}$${(absValue / 1e6).toFixed(1)}M`;
    return `${sign}$${absValue.toFixed(0)}`;
  };

  const getChangeColor = (value: number) => {
    if (value === 0) return 'text-gray-600';
    return value > 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatUsers = (users: number) => {
    if (users >= 1e6) return `${(users / 1e6).toFixed(1)}M`;
    if (users >= 1e3) return `${(users / 1e3).toFixed(1)}K`;
    return users.toLocaleString();
  };

  const formatCAGR = (cagr: number | null | undefined) => {
    if (cagr === null || cagr === undefined) return 'N/A';
    const sign = cagr > 0 ? '+' : '';
    return `${sign}${cagr.toFixed(1)}%`;
  };

  const getCAGRColor = (cagr: number | null | undefined) => {
    if (cagr === null || cagr === undefined) return 'text-gray-400';
    if (cagr > 0) return 'text-green-600';
    if (cagr < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendIcon = (trend: 'accelerating' | 'decelerating' | 'stable') => {
    switch (trend) {
      case 'accelerating':
        return '▲';
      case 'decelerating':
        return '▼';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const getTrendColor = (trend: 'accelerating' | 'decelerating' | 'stable') => {
    switch (trend) {
      case 'accelerating':
        return 'text-green-600';
      case 'decelerating':
        return 'text-red-600';
      case 'stable':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendText = (trend: 'accelerating' | 'decelerating' | 'stable') => {
    switch (trend) {
      case 'accelerating':
        return 'Accelerating';
      case 'decelerating':
        return 'Decelerating';
      case 'stable':
        return 'Stable';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with view switcher */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Market Overview
          </h2>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveView('overview')}
            className={`px-2 py-1 rounded text-xs ${
              activeView === 'overview' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('cagr')}
            className={`px-2 py-1 rounded text-xs ${
              activeView === 'cagr' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            CAGR
          </button>
          <button
            onClick={() => setActiveView('etf')}
            className={`px-2 py-1 rounded text-xs ${
              activeView === 'etf' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ETF
          </button>
        </div>
      </div>

      {/* Token Overview Table */}
      {activeView === 'overview' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                    Token
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    Price
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    24H
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    Market Cap
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    Users
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {tokens.map((token) => (
                  <tr key={token.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">{token.symbol.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {token.symbol}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium text-gray-900 dark:text-white">
                      {formatPrice(token.price)}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${getChangeColor(token.change24h || 0)}`}>
                        {token.change24h ? `${token.change24h > 0 ? '+' : ''}${token.change24h.toFixed(2)}%` : '0.00%'}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium text-gray-900 dark:text-white">
                      {formatMarketCap(token.marketCap)}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right text-xs text-gray-600 dark:text-gray-400">
                      {formatUsers(token.activeUsers || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CAGR Returns Table */}
      {activeView === 'cagr' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                    Token
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    Price
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    7D
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    30D
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    1Y
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    2Y
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    3Y
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    5Y
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {tokens.map((token) => (
                  <tr key={token.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">{token.symbol.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {token.symbol}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium text-gray-900 dark:text-white">
                      {formatPrice(token.price)}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${getChangeColor(token.change7d || 0)}`}>
                        {token.change7d ? `${token.change7d > 0 ? '+' : ''}${token.change7d.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${getChangeColor(token.change30d || 0)}`}>
                        {token.change30d ? `${token.change30d > 0 ? '+' : ''}${token.change30d.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${getCAGRColor(token.cagr1y)}`}>
                        {formatCAGR(token.cagr1y)}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${getCAGRColor(token.cagr2y)}`}>
                        {formatCAGR(token.cagr2y)}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${getCAGRColor(token.cagr3y)}`}>
                        {formatCAGR(token.cagr3y)}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${getCAGRColor(token.cagr5y)}`}>
                        {formatCAGR(token.cagr5y)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
            CAGR = Compound Annual Growth Rate. N/A indicates token wasn't available for full period.
          </div>
        </div>
      )}

      {/* ETF Holdings Table */}
      {activeView === 'etf' && etfData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-1 py-1 text-left text-xs font-medium text-gray-600 dark:text-gray-300">
                    Token
                  </th>
                  <th className="px-1 py-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">
                    ETFs
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    24H Flow
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    7D Flow
                  </th>
                  <th className="px-1 py-1 text-center text-xs font-medium text-gray-600 dark:text-gray-300">
                    Trend
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    AUM
                  </th>
                  <th className="px-1 py-1 text-right text-xs font-medium text-gray-600 dark:text-gray-300">
                    % Supply
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {etfData.map((etf) => (
                  <tr key={etf.token} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-bold">{etf.token.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {etf.token}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {etf.tokenName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-center text-xs text-gray-600 dark:text-gray-400">
                      {etf.totalETFs}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${etf.aggregateInflow24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatInflow(etf.aggregateInflow24h)}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right">
                      <span className={`text-xs font-medium ${etf.aggregateInflow7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatInflow(etf.aggregateInflow7d)}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-center">
                      <span className={`text-xs font-medium ${getTrendColor(etf.inflowTrend)}`}>
                        {getTrendIcon(etf.inflowTrend)}
                      </span>
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium text-gray-900 dark:text-white">
                      {formatMarketCap(etf.totalAUM)}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap text-right text-xs font-medium text-gray-900 dark:text-white">
                      {etf.percentOfTotalSupply.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-2 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
            Total 24H Flow: {formatInflow(etfData.reduce((sum, etf) => sum + etf.aggregateInflow24h, 0))} | 
            Total AUM: {formatMarketCap(etfData.reduce((sum, etf) => sum + etf.totalAUM, 0))}
          </div>
        </div>
      )}
      {activeView === 'etf' && etfData.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-600 dark:text-gray-300">
          ETF data is not configured. Provide a real data source to enable this view.
        </div>
      )}
      
      {/* Refresh Status */}
      <RefreshStatus showNextRefresh={true} />
    </div>
  );
}
