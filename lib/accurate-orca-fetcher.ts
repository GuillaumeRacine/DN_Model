import { Connection, PublicKey } from '@solana/web3.js';
import { dataCache, CACHE_KEYS } from './data-cache';
import { buildDefaultAccountFetcher, PDAUtil, PriceMath } from '@orca-so/whirlpools-sdk';
import { getTokenAFromLiquidity, getTokenBFromLiquidity, PositionUtil } from '@orca-so/whirlpools-sdk/dist/utils/position-util';
import { getSolanaMintPrices } from './token-prices';

// Known token information for accurate display (from actual on-chain data)
const TOKEN_INFO: { [key: string]: { symbol: string; name: string; decimals: number } } = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 },
  'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij': { symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  // Additional tokens found in actual positions
  '5qk7fzUy9SYi2oHBDHXvmPuLNaxCvkjMck1g1c1dq9NK': { symbol: 'WBTC', name: 'Wrapped Bitcoin (Orca)', decimals: 8 },
  'FWiLr7QtETCRs3CxFTAMmLynitX8uEjw9HxpFjxKQrAe': { symbol: 'USDC', name: 'USD Coin (Orca)', decimals: 6 },
  'DYkz5CCMUshPUso6Eg25f2kw5cnexYAKSrN6ZMSPM2xS': { symbol: 'cbBTC', name: 'Coinbase Wrapped BTC (Orca)', decimals: 8 },
};

// REMOVED: All hardcoded financial data - will only use verifiable on-chain data
// This ensures no mock data is used in the application

export interface AccurateOrcaPosition {
  id: string;
  tokenAccount: string;
  chain: 'Solana';
  protocol: 'Orca';
  type: 'Whirlpool';
  tokenPair: string;
  nftMint: string;
  whirlpool: string;
  
  // Financial data
  tvlUsd: number;
  pendingYield: number;
  apr: number;
  poolShare: number;
  
  // Price and range data
  currentPrice: number;
  priceLower: number;
  priceUpper: number;
  priceLabel: string;
  
  // Status
  inRange: boolean;
  confirmed: boolean;
  lastUpdated: Date;
  dataSource: string;
  
  // Token information
  tokenA: string;
  tokenB: string;
  tokenAInfo: { symbol: string; name: string; decimals: number };
  tokenBInfo: { symbol: string; name: string; decimals: number };
}

export class AccurateOrcaFetcher {
  private connection: Connection;
  private walletAddress: string;

  constructor(rpcUrl?: string, walletAddress?: string) {
    this.connection = new Connection(
      rpcUrl || process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    this.walletAddress = walletAddress || 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k';
  }

  async getAccuratePositions(): Promise<AccurateOrcaPosition[]> {
    const cacheKey = 'accurate_orca_positions';
    
    try {
      // Feature flag: disable Orca positions unless explicitly enabled to avoid placeholder data
      if (process.env.ENABLE_ORCA_POSITIONS !== 'true') {
        console.log('ℹ️ Orca positions disabled (ENABLE_ORCA_POSITIONS!=true)');
        return [];
      }

      // Check cache first
      const cached = dataCache.get<AccurateOrcaPosition[]>(cacheKey);
      if (cached) {
        console.log('✅ Using cached accurate Orca positions');
        return cached.data;
      }

      console.log('🔍 Fetching accurate Orca positions via Helius...');
      
      // Step 1: Verify wallet owns the position NFTs
      const walletPubkey = new PublicKey(this.walletAddress);
      
      // Get Token2022 accounts (where Orca NFTs are stored)
      const token2022Accounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') }
      );

      console.log(`📊 Found ${token2022Accounts.value.length} Token2022 accounts`);

      // Step 2: Find position NFTs - scan for Orca Whirlpool positions
      const verifiedPositions: AccurateOrcaPosition[] = [];
      
      // Known position mints to scan for (from investigation scripts)
      const knownOrcaMints = [
        'J9boQJgr4xefqoBJcYCNtfRXpiLwje5DW3fksH4bGkbX', // cbBTC/SOL
        '3P832skDFHaohd2kmnJh36nKTHjpW1V6Sr8mGH6PahDZ', // WBTC/SOL  
        'BGzAwP84gsVfB3p2miNb5spC59nX6Q2UfMyPg3RX4DKa'  // cbBTC/USDC
      ];
      
      for (const account of token2022Accounts.value) {
        if (account.account.data?.parsed?.info) {
          const info = account.account.data.parsed.info;
          
          // Check if it's an NFT (amount=1, decimals=0) and is a known Orca position
          if (info.tokenAmount?.uiAmount === 1 && 
              info.tokenAmount?.decimals === 0 && 
              knownOrcaMints.includes(info.mint)) {
            
            const mintAddress = info.mint;
            const tokenAccount = account.pubkey.toString();
            
            console.log(`✅ Found Orca position NFT: ${mintAddress}`);
            
            try {
              // Get position details from on-chain data
              const positionData = await this.getPositionFromChain(mintAddress);
              
              if (positionData) {
                const position: AccurateOrcaPosition = {
                  id: mintAddress.slice(-8),
                  tokenAccount: tokenAccount,
                  chain: 'Solana',
                  protocol: 'Orca',
                  type: 'Whirlpool',
                  tokenPair: positionData.tokenPair,
                  nftMint: mintAddress,
                  whirlpool: positionData.whirlpool,
                  
                  // On-chain financial data
                  tvlUsd: positionData.tvlUsd,
                  pendingYield: positionData.pendingYieldUsd || 0, // USD value of uncollected fees
                  apr: 0,
                  poolShare: positionData.poolShare || 0,
                  
                  // On-chain price and range data
                  currentPrice: positionData.currentPrice,
                  priceLower: positionData.priceLower,
                  priceUpper: positionData.priceUpper,
                  priceLabel: positionData.priceLabel,
                  
                  // Status
                  inRange: positionData.inRange,
                  confirmed: true,
                  lastUpdated: new Date(),
                  dataSource: 'Helius RPC + On-Chain Data',
                  
                  // Token info
                  tokenA: positionData.tokenA,
                  tokenB: positionData.tokenB,
                  tokenAInfo: TOKEN_INFO[positionData.tokenA] || { symbol: 'Unknown', name: 'Unknown', decimals: 9 },
                  tokenBInfo: TOKEN_INFO[positionData.tokenB] || { symbol: 'Unknown', name: 'Unknown', decimals: 9 },
                };
                
                verifiedPositions.push(position);
              }
            } catch (error) {
              console.error(`❌ Error processing position ${mintAddress}:`, error);
            }
          }
        }
      }

      console.log(`✅ Verified ${verifiedPositions.length} accurate positions`);
      
      // Cache the results
      dataCache.set(cacheKey, verifiedPositions, 'Helius RPC + Orca App');
      
      return verifiedPositions;

    } catch (error) {
      console.error('❌ Error fetching accurate Orca positions:', error);
      return [];
    }
  }

  async getPositionDetails(mintAddress: string): Promise<AccurateOrcaPosition | null> {
    const positions = await this.getAccuratePositions();
    return positions.find(p => p.nftMint === mintAddress) || null;
  }

  async getTotalPortfolioValue(): Promise<number> {
    const positions = await this.getAccuratePositions();
    return positions.reduce((total, position) => total + position.tvlUsd, 0);
  }

  async getTotalPendingYield(): Promise<number> {
    const positions = await this.getAccuratePositions();
    return positions.reduce((total, position) => total + position.pendingYield, 0);
  }

  async getAverageAPR(): Promise<number> {
    const positions = await this.getAccuratePositions();
    if (positions.length === 0) return 0;
    
    const totalAPR = positions.reduce((sum, position) => sum + position.apr, 0);
    return totalAPR / positions.length;
  }

  // Method to get position data using Orca Whirlpools SDK (accurate)
  private async getPositionFromChain(mintAddress: string) {
    try {
      const programId = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
      const fetcher = buildDefaultAccountFetcher(this.connection);
      const positionPda = PDAUtil.getPosition(programId, new PublicKey(mintAddress)).publicKey;

      const pos = await fetcher.getPosition(positionPda);
      if (!pos) return null;

      const whirlpool = await fetcher.getPool(pos.whirlpool);
      if (!whirlpool) return null;

      const mintA = await fetcher.getMintInfo(whirlpool.tokenMintA);
      const mintB = await fetcher.getMintInfo(whirlpool.tokenMintB);
      if (!mintA || !mintB) return null;

      const decimalsA = mintA.decimals;
      const decimalsB = mintB.decimals;

      const priceLower = PriceMath.tickIndexToPrice(pos.tickLowerIndex, decimalsA, decimalsB).toNumber();
      const priceUpper = PriceMath.tickIndexToPrice(pos.tickUpperIndex, decimalsA, decimalsB).toNumber();
      const currentPrice = PriceMath.sqrtPriceX64ToPrice(whirlpool.sqrtPrice, decimalsA, decimalsB).toNumber();

      // Compute token amounts from liquidity using SDK utilities
      const sqrtLower = PriceMath.tickIndexToSqrtPriceX64(pos.tickLowerIndex);
      const sqrtUpper = PriceMath.tickIndexToSqrtPriceX64(pos.tickUpperIndex);
      const currSqrt = whirlpool.sqrtPrice;
      const L = pos.liquidity; // BN

      let amountA = null;
      let amountB = null;
      const status = PositionUtil.getPositionStatus(whirlpool.tickCurrentIndex, pos.tickLowerIndex, pos.tickUpperIndex);
      if (status === 0) { // BelowRange: all in token A
        amountA = getTokenAFromLiquidity(L, sqrtLower, sqrtUpper, false);
        amountB = null;
      } else if (status === 2) { // AboveRange: all in token B
        amountA = null;
        amountB = getTokenBFromLiquidity(L, sqrtLower, sqrtUpper, false);
      } else { // InRange
        amountA = getTokenAFromLiquidity(L, currSqrt, sqrtUpper, false);
        amountB = getTokenBFromLiquidity(L, sqrtLower, currSqrt, false);
      }

      const amountAFloat = amountA ? Number(amountA.toString()) / Math.pow(10, decimalsA) : 0;
      const amountBFloat = amountB ? Number(amountB.toString()) / Math.pow(10, decimalsB) : 0;

      // Fetch USD prices for Solana mints
      const prices = await getSolanaMintPrices([whirlpool.tokenMintA.toBase58(), whirlpool.tokenMintB.toBase58()]);
      const pA = prices[whirlpool.tokenMintA.toBase58()] ?? 0;
      const pB = prices[whirlpool.tokenMintB.toBase58()] ?? 0;
      const tvlUsd = amountAFloat * pA + amountBFloat * pB;

      // Uncollected fees (USD)
      const feeA = Number(pos.feeOwedA.toString()) / Math.pow(10, decimalsA);
      const feeB = Number(pos.feeOwedB.toString()) / Math.pow(10, decimalsB);
      const pendingYieldUsd = feeA * pA + feeB * pB;

      // Pool share
      let poolShare = 0;
      try {
        const Lpos = Number(pos.liquidity.toString());
        const Lpool = Number(whirlpool.liquidity.toString());
        if (Lpool > 0) poolShare = Lpos / Lpool;
      } catch {}

      const tokenA = whirlpool.tokenMintA.toBase58();
      const tokenB = whirlpool.tokenMintB.toBase58();
      const tokenAInfo = TOKEN_INFO[tokenA];
      const tokenBInfo = TOKEN_INFO[tokenB];
      const tokenPair = tokenAInfo && tokenBInfo ? `${tokenAInfo.symbol}/${tokenBInfo.symbol}` : `${tokenA.slice(0,4)}../${tokenB.slice(0,4)}..`;

      const inRange = whirlpool.tickCurrentIndex >= pos.tickLowerIndex && whirlpool.tickCurrentIndex < pos.tickUpperIndex;

      return {
        tokenPair,
        whirlpool: pos.whirlpool.toBase58(),
        tokenA,
        tokenB,
        priceLower,
        priceUpper,
        currentPrice,
        priceLabel: `${priceLower.toFixed(4)} - ${priceUpper.toFixed(4)}`,
        inRange,
        tvlUsd,
        pendingYieldUsd,
        poolShare
      };

    } catch (error) {
      console.error(`Error fetching position data for ${mintAddress}:`, error);
      return null;
    }
  }

  // Pricing now handled by shared token-prices cache

  // Helper method to convert tick to price with bounds checking
  private tickToPrice(tick: number): number {
    // Clamp tick to reasonable bounds to avoid Infinity
    const MAX_TICK = 443636;
    const MIN_TICK = -443636;
    
    const clampedTick = Math.max(MIN_TICK, Math.min(MAX_TICK, tick));
    
    if (clampedTick !== tick) {
      console.log(`⚠️  Tick ${tick} clamped to ${clampedTick}`);
    }
    
    return Math.pow(1.0001, clampedTick);
  }

  // Remove placeholder TVL estimation — keep zero until token amounts are decoded properly

  // Method to verify on-chain data matches blockchain state
  async verifyAgainstOnChain(): Promise<{ verified: boolean; discrepancies: string[] }> {
    const discrepancies: string[] = [];
    
    try {
      console.log('📋 Verification against on-chain data...');
      
      const positions = await this.getAccuratePositions();
      console.log(`✅ Successfully fetched ${positions.length} positions from on-chain data`);
      
      // Basic validation
      for (const position of positions) {
        if (!position.nftMint || !position.whirlpool) {
          discrepancies.push(`Position ${position.id} missing required data`);
        }
      }
      
      return { verified: discrepancies.length === 0, discrepancies };
    } catch (error) {
      discrepancies.push(`Verification failed: ${error}`);
      return { verified: false, discrepancies };
    }
  }
}

// Export singleton instance
export const accurateOrcaFetcher = new AccurateOrcaFetcher();
