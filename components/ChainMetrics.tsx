'use client';

import { CHAIN_DISPLAY_NAMES } from '../lib/defillama-api';
import { useAppStore } from '../lib/store';

interface ChainMetricsProps {
  data: any;
  detailed?: boolean;
}

export default function ChainMetrics({ data, detailed }: ChainMetricsProps) {
  const { selectedChains } = useAppStore();
  
  const formatNumber = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    const formatted = value.toFixed(2);
    return value > 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const filteredChains = data.chains?.filter((chain: any) => 
    selectedChains.includes(chain.chain)
  ) || [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Chain Metrics
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChains.map((chain: any) => (
          <div
            key={chain.chain}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {CHAIN_DISPLAY_NAMES[chain.chain]}
              </h3>
              <span className={`text-sm font-medium px-2 py-1 rounded ${
                chain.tvlChange24h > 0 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {formatPercent(chain.tvlChange24h)}
              </span>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">TVL</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(chain.tvl)}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Protocols</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {chain.protocolCount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pools</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {chain.poolCount}
                  </p>
                </div>
              </div>

              {detailed && chain.topPools?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Top Pools:
                  </p>
                  <div className="space-y-1">
                    {chain.topPools.slice(0, 3).map((pool: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                          {pool.symbol}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatNumber(pool.tvlUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}