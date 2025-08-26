'use client';

import { useState } from 'react';
import { useAppStore } from '../lib/store';

interface ProtocolsListProps {
  protocols: any[];
}

export default function ProtocolsList({ protocols }: ProtocolsListProps) {
  const { selectedChains } = useAppStore();
  const [sortBy, setSortBy] = useState<'tvl' | 'change'>('tvl');

  const formatNumber = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    if (!value) return '0.00%';
    const formatted = value.toFixed(2);
    return value > 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const filteredProtocols = protocols?.filter(p => 
    p.chains?.some((chain: string) => selectedChains.includes(chain.toLowerCase()))
  ) || [];

  const sortedProtocols = [...filteredProtocols].sort((a, b) => {
    if (sortBy === 'tvl') return b.tvl - a.tvl;
    return (b.change_1d || 0) - (a.change_1d || 0);
  });

  const getChainTVL = (protocol: any, chain: string) => {
    return protocol.chainTvls?.[chain] || 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Top Protocols
        </h2>
        <div className="flex gap-2">
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
          <button
            onClick={() => setSortBy('change')}
            className={`px-3 py-1 rounded ${
              sortBy === 'change' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Sort by 24h Change
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedProtocols.slice(0, 18).map((protocol) => (
          <div
            key={protocol.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                {protocol.logo && (
                  <img
                    src={protocol.logo}
                    alt={protocol.name}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {protocol.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {protocol.category}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total TVL</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(protocol.tvl)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">24h Change</span>
                <span className={`font-medium ${
                  protocol.change_1d > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercent(protocol.change_1d)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">7d Change</span>
                <span className={`font-medium ${
                  protocol.change_7d > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPercent(protocol.change_7d)}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Chains:</p>
                <div className="flex flex-wrap gap-1">
                  {protocol.chains?.slice(0, 5).map((chain: string) => (
                    <span
                      key={chain}
                      className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded"
                    >
                      {chain}
                    </span>
                  ))}
                  {protocol.chains?.length > 5 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      +{protocol.chains.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}