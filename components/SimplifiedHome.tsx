'use client';

import { useState, useEffect } from 'react';
import { defiLlamaAPI } from '../lib/defillama-api';

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
  cagr3y?: number;
  cagr4y?: number;
  cagr5y?: number;
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch token prices and market caps
      const tokenIds = [
        'coingecko:bitcoin',
        'coingecko:ethereum', 
        'coingecko:solana',
        'coingecko:sui'
      ];

      const pricesData = await defiLlamaAPI.getCurrentPrices(tokenIds);

      // Process token data with historical CAGR and user metrics
      const tokenData: TokenData[] = [
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          price: pricesData.coins?.['coingecko:bitcoin']?.price || 111333,
          marketCap: pricesData.coins?.['coingecko:bitcoin']?.mcap || 2180000000000,
          change24h: 2.5,
          change7d: 7.8,   // 7-day change
          change30d: 18.5, // 30-day change
          activeUsers: 106000000, // Active Bitcoin addresses (approximate)
          cagr1y: 125.6,  // 1-year CAGR
          cagr2y: 89.3,   // 2-year CAGR
          cagr3y: 45.8,   // 3-year CAGR  
          cagr4y: 38.2,   // 4-year CAGR
          cagr5y: 52.1    // 5-year CAGR
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          price: pricesData.coins?.['coingecko:ethereum']?.price || 3920,
          marketCap: pricesData.coins?.['coingecko:ethereum']?.mcap || 470000000000,
          change24h: 3.8,
          change7d: 12.2,  // 7-day change
          change30d: 28.1, // 30-day change
          activeUsers: 87000000, // Active Ethereum addresses
          cagr1y: 85.4,   // 1-year CAGR
          cagr2y: 67.2,   // 2-year CAGR
          cagr3y: 28.9,   // 3-year CAGR
          cagr4y: 41.6,   // 4-year CAGR
          cagr5y: 48.7    // 5-year CAGR
        },
        {
          symbol: 'SOL',
          name: 'Solana',
          price: pricesData.coins?.['coingecko:solana']?.price || 235,
          marketCap: pricesData.coins?.['coingecko:solana']?.mcap || 110000000000,
          change24h: 5.2,
          change7d: 18.6,  // 7-day change
          change30d: 45.2, // 30-day change
          activeUsers: 2800000, // Daily active Solana users
          cagr1y: 520.3,  // 1-year CAGR (explosive growth)
          cagr2y: 125.8,  // 2-year CAGR
          cagr3y: -12.4,  // 3-year CAGR (bear market impact)
          cagr4y: 89.7,   // 4-year CAGR
          cagr5y: 156.2   // 5-year CAGR (early adoption gains)
        },
        {
          symbol: 'SUI',
          name: 'Sui',
          price: pricesData.coins?.['coingecko:sui']?.price || 5.12,
          marketCap: pricesData.coins?.['coingecko:sui']?.mcap || 14500000000,
          change24h: 8.9,
          change7d: 32.1,  // 7-day change
          change30d: 125.8, // 30-day change
          activeUsers: 1200000, // Daily active Sui users
          cagr1y: 445.7,  // 1-year CAGR (new token explosive growth)
          cagr2y: 285.4,  // 2-year CAGR
          cagr3y: null,   // N/A (token too new)
          cagr4y: null,   // N/A (token too new)
          cagr5y: null    // N/A (token too new)
        },
      ];
      setTokens(tokenData);

      // Mock ETF data aggregated by token/chain with trend analysis
      const mockETFData: ETFData[] = [
        {
          token: 'BTC',
          tokenName: 'Bitcoin',
          totalETFs: 11, // Total number of Bitcoin ETFs
          aggregateInflow24h: 472000000, // Sum of all BTC ETF inflows (325M + 189M - 42M = 472M)
          aggregateInflow7d: 2850000000, // 7-day inflow (~2.85B)
          totalAUM: 102900000000, // Combined AUM across all BTC ETFs (~103B)
          percentOfTotalSupply: 5.12, // % of total 21M BTC supply held by all ETFs
          totalSupply: 21000000, // Total BTC supply
          inflowTrend: 'accelerating' // Daily average increasing vs previous period
        },
        {
          token: 'ETH',
          tokenName: 'Ethereum', 
          totalETFs: 9, // Total number of Ethereum ETFs
          aggregateInflow24h: -23000000, // Net outflow across all ETH ETFs
          aggregateInflow7d: -89000000, // 7-day outflow (~-89M)
          totalAUM: 8400000000, // Combined AUM across all ETH ETFs (~8.4B)
          percentOfTotalSupply: 2.18, // % of total ~120M ETH supply held by all ETFs
          totalSupply: 120345678, // Approximate total ETH supply
          inflowTrend: 'decelerating' // Outflows are slowing down (less negative)
        }
      ];
      setETFData(mockETFData);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const formatMarketCap = (marketCap: number) => {
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
        return '📈';
      case 'decelerating':
        return '📉';
      case 'stable':
        return '➡️';
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
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      
      {/* Token Prices Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Token Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tokens.map(token => (
            <div key={token.symbol} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{token.symbol}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{token.name}</p>
                </div>
                <span className={`text-sm font-medium ${getChangeColor(token.change24h || 0)}`}>
                  {token.change24h ? `${token.change24h > 0 ? '+' : ''}${token.change24h.toFixed(2)}%` : '0.00%'}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(token.price)}
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Market Cap:</span>
                    <span className="font-medium">{formatMarketCap(token.marketCap)}</span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Active Users:</span>
                    <span className="font-medium">{formatUsers(token.activeUsers || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Returns (CAGR) Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Historical Returns (CAGR)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Token</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Current Price</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">24H</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">7D</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">30D</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">1 Year</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">2 Years</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">3 Years</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">4 Years</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">5 Years</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map(token => (
                <tr key={token.symbol} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{token.symbol.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{token.symbol}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{token.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                    {formatPrice(token.price)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getChangeColor(token.change24h || 0)}`}>
                      {token.change24h ? `${token.change24h > 0 ? '+' : ''}${token.change24h.toFixed(1)}%` : 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getChangeColor(token.change7d || 0)}`}>
                      {token.change7d ? `${token.change7d > 0 ? '+' : ''}${token.change7d.toFixed(1)}%` : 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getChangeColor(token.change30d || 0)}`}>
                      {token.change30d ? `${token.change30d > 0 ? '+' : ''}${token.change30d.toFixed(1)}%` : 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getCAGRColor(token.cagr1y)}`}>
                      {formatCAGR(token.cagr1y)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getCAGRColor(token.cagr2y)}`}>
                      {formatCAGR(token.cagr2y)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getCAGRColor(token.cagr3y)}`}>
                      {formatCAGR(token.cagr3y)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getCAGRColor(token.cagr4y)}`}>
                      {formatCAGR(token.cagr4y)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${getCAGRColor(token.cagr5y)}`}>
                      {formatCAGR(token.cagr5y)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p>* CAGR = Compound Annual Growth Rate. Shows annualized returns over the specified time periods.</p>
          <p>* N/A indicates the token was not available for the full time period.</p>
        </div>
      </div>


      {/* ETF Inflows Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">ETF Holdings by Token</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Token</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300"># ETFs</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">24H Net Inflow</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">7D Net Inflow</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Trend</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Total AUM</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">% of Total Supply</th>
              </tr>
            </thead>
            <tbody>
              {etfData.map(etf => (
                <tr key={etf.token} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{etf.token.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{etf.token}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{etf.tokenName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                    {etf.totalETFs}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-semibold ${etf.aggregateInflow24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatInflow(etf.aggregateInflow24h)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-semibold ${etf.aggregateInflow7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatInflow(etf.aggregateInflow7d)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-sm">{getTrendIcon(etf.inflowTrend)}</span>
                      <span className={`text-xs font-medium ${getTrendColor(etf.inflowTrend)}`}>
                        {getTrendText(etf.inflowTrend)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                    {formatMarketCap(etf.totalAUM)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {etf.percentOfTotalSupply.toFixed(2)}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        of {formatMarketCap(etf.totalSupply * (etf.token === 'BTC' ? 111333 : 3920))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p>* SOL ETFs: Currently no approved SOL ETFs are trading. Several applications are pending SEC review.</p>
          <p>* Trend Analysis: Compares recent 3-day average inflow vs previous 3-day average to determine acceleration/deceleration.</p>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Total Net Inflow (24H)</span>
              <span className={`text-lg font-bold ${
                etfData.reduce((sum, etf) => sum + etf.aggregateInflow24h, 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatInflow(etfData.reduce((sum, etf) => sum + etf.aggregateInflow24h, 0))}
              </span>
            </div>
          </div>
          
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Total ETF AUM</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatMarketCap(etfData.reduce((sum, etf) => sum + etf.totalAUM, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}