'use client';

import { useState, useEffect } from 'react';
import { moralisHelpers } from '../lib/moralis-api';

interface MoralisPosition {
  type: 'TOKEN' | 'NFT' | 'DEFI';
  chain: string;
  protocol?: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  balance?: string;
  usdValue?: number;
  tokenId?: string;
  metadata?: any;
  possibleLP: boolean;
}

interface MoralisLPFinderProps {
  walletAddress: string;
  chainType: 'EVM' | 'SOLANA';
  onPositionsFound?: (positions: MoralisPosition[]) => void;
}

export default function MoralisPositionFinder({ walletAddress, chainType, onPositionsFound }: MoralisLPFinderProps) {
  const [positions, setPositions] = useState<MoralisPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalTokens: 0,
    potentialLPs: 0,
    nftPositions: 0,
    defiPositions: 0,
    chainsCovered: [] as string[],
  });
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const scanPositions = async () => {
    if (!walletAddress || loading) return;
    
    setLoading(true);
    console.log(`🔍 Starting Moralis scan for ${chainType} wallet: ${walletAddress}`);
    
    try {
      const allPositions: MoralisPosition[] = [];
      
      if (chainType === 'EVM') {
        // Scan EVM chains (Base, Ethereum, Arbitrum)
        const results = await moralisHelpers.getAllLPPositions(walletAddress);
        
        // Process Base positions
        results.base.tokens.forEach(token => {
          allPositions.push({
            type: 'TOKEN',
            chain: 'Base',
            tokenAddress: token.token_address,
            symbol: token.symbol,
            name: token.name,
            balance: token.balance_formatted,
            usdValue: token.usd_value,
            possibleLP: true, // Already filtered for LP tokens
          });
        });

        results.base.nfts.forEach(nft => {
          allPositions.push({
            type: 'NFT',
            chain: 'Base',
            protocol: nft.name.includes('Uniswap') ? 'Uniswap V3' : 
                     nft.name.includes('Aerodrome') ? 'Aerodrome' : 'Unknown',
            tokenAddress: nft.token_address,
            symbol: nft.symbol,
            name: nft.name,
            tokenId: nft.token_id,
            metadata: nft.metadata,
            possibleLP: true,
          });
        });

        results.base.defi.forEach(defi => {
          allPositions.push({
            type: 'DEFI',
            chain: 'Base',
            protocol: defi.protocol_name,
            tokenAddress: 'defi-position',
            symbol: defi.protocol_name,
            name: `${defi.protocol_name} ${defi.position_type}`,
            usdValue: defi.total_usd_value,
            possibleLP: defi.position_type === 'liquidity',
          });
        });

        // Process Ethereum positions
        results.ethereum.tokens.forEach(token => {
          allPositions.push({
            type: 'TOKEN',
            chain: 'Ethereum',
            tokenAddress: token.token_address,
            symbol: token.symbol,
            name: token.name,
            balance: token.balance_formatted,
            usdValue: token.usd_value,
            possibleLP: true,
          });
        });

        results.ethereum.nfts.forEach(nft => {
          allPositions.push({
            type: 'NFT',
            chain: 'Ethereum',
            protocol: nft.name.includes('Uniswap') ? 'Uniswap V3' : 'Unknown',
            tokenAddress: nft.token_address,
            symbol: nft.symbol,
            name: nft.name,
            tokenId: nft.token_id,
            metadata: nft.metadata,
            possibleLP: true,
          });
        });

        // Process Arbitrum positions
        results.arbitrum.tokens.forEach(token => {
          allPositions.push({
            type: 'TOKEN',
            chain: 'Arbitrum',
            tokenAddress: token.token_address,
            symbol: token.symbol,
            name: token.name,
            balance: token.balance_formatted,
            usdValue: token.usd_value,
            possibleLP: true,
          });
        });

        setSummary({
          totalTokens: results.summary.totalLPTokens + results.summary.totalNFTPositions + results.summary.totalDeFiPositions,
          potentialLPs: results.summary.totalLPTokens,
          nftPositions: results.summary.totalNFTPositions,
          defiPositions: results.summary.totalDeFiPositions,
          chainsCovered: results.summary.chainsCovered,
        });

      } else if (chainType === 'SOLANA') {
        // Scan Solana
        const solanaResults = await moralisHelpers.getSolanaLPPositions(walletAddress);
        
        solanaResults.tokens.forEach(token => {
          allPositions.push({
            type: 'TOKEN',
            chain: 'Solana',
            tokenAddress: token.mint,
            symbol: token.symbol,
            name: token.name,
            balance: token.amount,
            usdValue: token.usdValue,
            possibleLP: true,
          });
        });

        setSummary({
          totalTokens: solanaResults.totalTokens,
          potentialLPs: solanaResults.potentialLPTokens,
          nftPositions: 0,
          defiPositions: 0,
          chainsCovered: ['solana'],
        });
      }

      setPositions(allPositions);
      setLastScan(new Date());
      
      // Callback with found positions
      if (onPositionsFound) {
        onPositionsFound(allPositions);
      }

      console.log(`✅ Moralis scan complete: Found ${allPositions.length} potential LP positions`);
      
    } catch (error) {
      console.error('❌ Error during Moralis scan:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionTypeIcon = (type: string) => {
    switch (type) {
      case 'TOKEN': return '🪙';
      case 'NFT': return '🎨';
      case 'DEFI': return '🏦';
      default: return '❓';
    }
  };

  const formatValue = (value: number | undefined) => {
    if (!value || value === 0) return 'N/A';
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Moralis LP Finder - {chainType}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Discovering liquidity positions using Moralis API
          </p>
        </div>
        <button
          onClick={scanPositions}
          disabled={loading || !walletAddress}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            loading 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? '🔍 Scanning...' : '🔍 Scan LP Positions'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Found</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {summary.totalTokens}
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <div className="text-xs text-blue-600 dark:text-blue-400">LP Tokens</div>
          <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            {summary.potentialLPs}
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
          <div className="text-xs text-purple-600 dark:text-purple-400">NFT Positions</div>
          <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
            {summary.nftPositions}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <div className="text-xs text-green-600 dark:text-green-400">DeFi Positions</div>
          <div className="text-lg font-semibold text-green-900 dark:text-green-100">
            {summary.defiPositions}
          </div>
        </div>
      </div>

      {/* Positions Table */}
      {positions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">Type</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">Chain</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">Token/Position</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">Protocol</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">Balance</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">USD Value</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300">Address</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2 px-3">
                    <span className="flex items-center gap-2">
                      {getPositionTypeIcon(position.type)}
                      <span className="text-xs font-medium">{position.type}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {position.chain}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div>
                      <div className="text-xs font-medium text-gray-900 dark:text-white">
                        {position.symbol}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-32">
                        {position.name}
                      </div>
                      {position.tokenId && (
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          ID: {position.tokenId}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {position.protocol || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {position.balance || 'N/A'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      {formatValue(position.usdValue)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">
                      {position.tokenAddress.slice(0, 8)}...
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status */}
      {lastScan && (
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Last scan: {lastScan.toLocaleString()} | 
          Chains: {summary.chainsCovered.join(', ')} | 
          Found {positions.filter(p => p.possibleLP).length} potential LP positions
        </div>
      )}

      {positions.length === 0 && !loading && lastScan && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No LP positions found with Moralis API
        </div>
      )}
    </div>
  );
}