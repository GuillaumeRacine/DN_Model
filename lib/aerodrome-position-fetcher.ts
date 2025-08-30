// Real Aerodrome Slipstream position fetcher for Base network
import { ethers } from 'ethers';

// Base network RPC endpoints (free options available)
const BASE_RPC_URLS = [
  'https://base.llamarpc.com', // LlamaNodes (often more reliable)
  'https://base.rpc.thirdweb.com', // Thirdweb RPC
  'https://base.blockpi.network/v1/rpc/public', // BlockPI public RPC
  'https://mainnet.base.org', // Base official RPC
  'https://base-mainnet.public.blastapi.io', // Blast API
];

// Aerodrome Slipstream contract addresses on Base
export const AERODROME_CONTRACTS = {
  POSITION_MANAGER: '0x827922686190790b37229fd06084350E74485b72',
  POOL_FACTORY: '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
  SWAP_ROUTER: '0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5',
  GAUGE_FACTORY: '0xD30677bd8dd15132F251Cb54CbDA552d2A05Fb08',
};

// Common token addresses on Base
export const BASE_TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  USDBC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USD Base Coin
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
};

// Simplified ABI for NonfungiblePositionManager (Uniswap V3 compatible)
const POSITION_MANAGER_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function tokenURI(uint256 tokenId) external view returns (string)'
];

// Pool contract ABI
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
  'function liquidity() external view returns (uint128)'
];

// Pool Factory ABI
const FACTORY_ABI = [
  'function getPool(address token0, address token1, int24 tickSpacing) external view returns (address pool)'
];

// ERC20 ABI for token info
const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

export interface AerodromePosition {
  tokenId: string;
  owner: string;
  pool: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  fee: number;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  liquidity: string;
  priceLower: number;
  priceUpper: number;
  currentPrice: number;
  inRange: boolean;
  tvlUsd: number;
  token0Amount: string;
  token1Amount: string;
  uncollectedFees0: string;
  uncollectedFees1: string;
  lastUpdated: Date;
}

class AerodromePositionFetcher {
  private provider: ethers.JsonRpcProvider | null = null;
  private positionManager: ethers.Contract | null = null;
  private factory: ethers.Contract | null = null;
  private currentRpcIndex = 0;

  constructor() {
    // Provider will be initialized when needed with failover logic
  }

  // Initialize provider with RPC failover and timeout handling
  private async initializeProvider(): Promise<void> {
    if (this.provider && this.positionManager && this.factory) {
      return; // Already initialized
    }

    let lastError: Error | null = null;

    for (let i = 0; i < BASE_RPC_URLS.length; i++) {
      const rpcUrl = BASE_RPC_URLS[i];
      
      try {
        console.log(`🔄 Trying Base RPC: ${rpcUrl}`);
        
        // Create provider with timeout
        const provider = new ethers.JsonRpcProvider(rpcUrl, {
          name: 'base',
          chainId: 8453
        });
        
        // Test the connection with a timeout
        const connectionPromise = provider.getBlockNumber();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        );
        
        await Promise.race([connectionPromise, timeoutPromise]);
        
        console.log(`✅ Successfully connected to Base RPC: ${rpcUrl}`);
        
        this.provider = provider;
        this.currentRpcIndex = i;
        
        this.positionManager = new ethers.Contract(
          AERODROME_CONTRACTS.POSITION_MANAGER,
          POSITION_MANAGER_ABI,
          this.provider
        );
        
        this.factory = new ethers.Contract(
          AERODROME_CONTRACTS.POOL_FACTORY,
          FACTORY_ABI,
          this.provider
        );
        
        return; // Success!
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Failed to connect to ${rpcUrl}: ${errorMsg}`);
        lastError = error instanceof Error ? error : new Error('Connection failed');
        
        // Don't retry if it's a network/CORS issue
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('CORS')) {
          console.log('🚫 Network/CORS issue detected, skipping remaining RPC endpoints');
          break;
        }
        
        continue;
      }
    }
    
    throw new Error(`All Base RPC endpoints failed. Last error: ${lastError?.message || 'Network connectivity issues'}`);
  }

  // Retry with next RPC if current one fails
  private async retryWithNextRpc<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.log(`❌ RPC call failed, trying next endpoint...`);
      
      // Try next RPC
      this.currentRpcIndex = (this.currentRpcIndex + 1) % BASE_RPC_URLS.length;
      this.provider = null;
      this.positionManager = null;
      this.factory = null;
      
      await this.initializeProvider();
      return await operation();
    }
  }

  // Get token information
  private async getTokenInfo(tokenAddress: string) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    
    try {
      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);
      
      return {
        address: tokenAddress,
        symbol,
        decimals: Number(decimals)
      };
    } catch (error) {
      // Fallback for known tokens
      const knownTokens: { [key: string]: { symbol: string; decimals: number } } = {
        [BASE_TOKENS.WETH]: { symbol: 'WETH', decimals: 18 },
        [BASE_TOKENS.USDC]: { symbol: 'USDC', decimals: 6 },
        [BASE_TOKENS.AERO]: { symbol: 'AERO', decimals: 18 },
        [BASE_TOKENS.USDBC]: { symbol: 'USDbC', decimals: 6 },
        [BASE_TOKENS.DAI]: { symbol: 'DAI', decimals: 18 },
      };
      
      const known = knownTokens[tokenAddress.toLowerCase()];
      if (known) {
        return {
          address: tokenAddress,
          symbol: known.symbol,
          decimals: known.decimals
        };
      }
      
      return {
        address: tokenAddress,
        symbol: 'UNKNOWN',
        decimals: 18
      };
    }
  }

  // Convert tick to price using Uniswap V3 formula
  private tickToPrice(tick: number, decimals0: number, decimals1: number): number {
    const price = Math.pow(1.0001, tick);
    // Adjust for token decimals
    return price * Math.pow(10, decimals0 - decimals1);
  }

  // Convert sqrtPriceX96 to price
  private sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
    const Q96 = BigInt('79228162514264337593543950336'); // 2^96
    const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
    return price * Math.pow(10, decimals0 - decimals1);
  }

  // Calculate position liquidity in terms of token amounts
  private calculatePositionAmounts(
    liquidity: string,
    tickLower: number,
    tickUpper: number,
    currentTick: number,
    decimals0: number,
    decimals1: number
  ): { amount0: string; amount1: string } {
    const liquidityBN = BigInt(liquidity);
    
    if (currentTick < tickLower) {
      // All liquidity in token0
      const amount0 = liquidityBN * BigInt(Math.floor(1 / Math.sqrt(Math.pow(1.0001, tickLower)) - 1 / Math.sqrt(Math.pow(1.0001, tickUpper))));
      return {
        amount0: ethers.formatUnits(amount0, decimals0),
        amount1: '0'
      };
    } else if (currentTick >= tickUpper) {
      // All liquidity in token1
      const amount1 = liquidityBN * BigInt(Math.floor(Math.sqrt(Math.pow(1.0001, tickUpper)) - Math.sqrt(Math.pow(1.0001, tickLower))));
      return {
        amount0: '0',
        amount1: ethers.formatUnits(amount1, decimals1)
      };
    } else {
      // Liquidity distributed between both tokens
      const currentPrice = Math.pow(1.0001, currentTick);
      const lowerPrice = Math.pow(1.0001, tickLower);
      const upperPrice = Math.pow(1.0001, tickUpper);
      
      const amount0 = Number(liquidityBN) * (1 / Math.sqrt(currentPrice) - 1 / Math.sqrt(upperPrice));
      const amount1 = Number(liquidityBN) * (Math.sqrt(currentPrice) - Math.sqrt(lowerPrice));
      
      return {
        amount0: (amount0 * Math.pow(10, -decimals0)).toFixed(decimals0),
        amount1: (amount1 * Math.pow(10, -decimals1)).toFixed(decimals1)
      };
    }
  }

  // Fetch USD prices for Base tokens using DeFiLlama Pro (if configured)
  private async getUsdPricesBase(addresses: string[]): Promise<Record<string, number>> {
    try {
      const { getBaseTokenPrices } = await import('./token-prices');
      return await getBaseTokenPrices(addresses);
    } catch {
      return {};
    }
  }

  // Get pool contract for token pair
  private async getPool(token0: string, token1: string, fee: number): Promise<string> {
    // Determine tick spacing based on fee
    let tickSpacing: number;
    switch (fee) {
      case 100: tickSpacing = 1; break;
      case 500: tickSpacing = 10; break;
      case 3000: tickSpacing = 60; break;
      case 10000: tickSpacing = 200; break;
      default: tickSpacing = 60;
    }
    
    try {
      if (!this.factory) {
        throw new Error('Factory not initialized');
      }
      const poolAddress = await this.factory.getPool(token0, token1, tickSpacing);
      return poolAddress;
    } catch (error) {
      console.error('Error getting pool address:', error);
      return ethers.ZeroAddress;
    }
  }

  // Get current pool state
  private async getPoolState(poolAddress: string) {
    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
    
    try {
      const [slot0, token0, token1, fee] = await Promise.all([
        poolContract.slot0(),
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee()
      ]);
      
      return {
        sqrtPriceX96: slot0.sqrtPriceX96,
        currentTick: Number(slot0.tick),
        token0,
        token1,
        fee: Number(fee)
      };
    } catch (error) {
      console.error('Error getting pool state:', error);
      return null;
    }
  }

  // Fetch positions for a specific wallet
  async fetchPositions(walletAddress: string): Promise<AerodromePosition[]> {
    const positions: AerodromePosition[] = [];
    
    try {
      console.log(`🔍 Fetching Aerodrome positions for wallet: ${walletAddress}`);
      
      // Initialize provider with failover
      await this.initializeProvider();
      
      if (!this.positionManager) {
        throw new Error('Position manager not initialized');
      }
      
      // Get number of NFTs owned by the wallet
      const balance = await this.retryWithNextRpc(async () => {
        return await this.positionManager!.balanceOf(walletAddress);
      });
      const numPositions = Number(balance);
      
      console.log(`📊 Found ${numPositions} Aerodrome position NFTs`);
      
      if (numPositions === 0) {
        console.log('❌ No Aerodrome positions found');
        return positions;
      }
      
      // Fetch each position
      for (let i = 0; i < numPositions; i++) {
        try {
          // Get token ID
          const tokenId = await this.positionManager.tokenOfOwnerByIndex(walletAddress, i);
          console.log(`🔄 Processing position NFT #${tokenId}`);
          
          // Get position details
          const positionData = await this.positionManager.positions(tokenId);
          
          const {
            token0: token0Address,
            token1: token1Address,
            fee,
            tickLower,
            tickUpper,
            liquidity,
            tokensOwed0,
            tokensOwed1
          } = positionData;
          
          // Skip positions with no liquidity
          if (BigInt(liquidity) === BigInt(0)) {
            console.log(`⏭️  Skipping position #${tokenId} - no liquidity`);
            continue;
          }
          
          // Get token information
          const [token0Info, token1Info] = await Promise.all([
            this.getTokenInfo(token0Address),
            this.getTokenInfo(token1Address)
          ]);
          
          // Get pool address
          const poolAddress = await this.getPool(token0Address, token1Address, Number(fee));
          
          if (poolAddress === ethers.ZeroAddress) {
            console.log(`⏭️  Skipping position #${tokenId} - pool not found`);
            continue;
          }
          
          // Get current pool state
          const poolState = await this.getPoolState(poolAddress);
          
          if (!poolState) {
            console.log(`⏭️  Skipping position #${tokenId} - pool state unavailable`);
            continue;
          }
          
          // Calculate prices
          const currentPrice = this.sqrtPriceX96ToPrice(
            poolState.sqrtPriceX96,
            token0Info.decimals,
            token1Info.decimals
          );
          
          const priceLower = this.tickToPrice(
            Number(tickLower),
            token0Info.decimals,
            token1Info.decimals
          );
          
          const priceUpper = this.tickToPrice(
            Number(tickUpper),
            token0Info.decimals,
            token1Info.decimals
          );
          
          // Check if position is in range
          const inRange = poolState.currentTick >= Number(tickLower) && 
                         poolState.currentTick < Number(tickUpper);
          
          // Calculate token amounts
          const amounts = this.calculatePositionAmounts(
            liquidity.toString(),
            Number(tickLower),
            Number(tickUpper),
            poolState.currentTick,
            token0Info.decimals,
            token1Info.decimals
          );
          
          // Estimate TVL in USD
          let tvlUsd = 0;
          const isStable0 = token0Info.symbol === 'USDC' || token0Info.symbol === 'USDbC';
          const isStable1 = token1Info.symbol === 'USDC' || token1Info.symbol === 'USDbC';
          if (isStable0) {
            tvlUsd = parseFloat(amounts.amount0) + (parseFloat(amounts.amount1) * currentPrice);
          } else if (isStable1) {
            tvlUsd = parseFloat(amounts.amount1) + (parseFloat(amounts.amount0) / currentPrice);
          } else {
            // Fetch USD prices for both tokens via DeFiLlama Pro if available
            const prices = await this.getUsdPricesBase([token0Info.address, token1Info.address]);
            const p0 = prices[token0Info.address.toLowerCase()];
            const p1 = prices[token1Info.address.toLowerCase()];
            if (typeof p0 === 'number' && typeof p1 === 'number') {
              tvlUsd = parseFloat(amounts.amount0) * p0 + parseFloat(amounts.amount1) * p1;
            } else {
              tvlUsd = 0; // Unknown — leave as 0 rather than guessing
            }
          }
          
          const position: AerodromePosition = {
            tokenId: tokenId.toString(),
            owner: walletAddress,
            pool: poolAddress,
            token0: token0Info,
            token1: token1Info,
            fee: Number(fee) / 10000, // Convert basis points to percentage
            tickLower: Number(tickLower),
            tickUpper: Number(tickUpper),
            currentTick: poolState.currentTick,
            liquidity: liquidity.toString(),
            priceLower,
            priceUpper,
            currentPrice,
            inRange,
            tvlUsd,
            token0Amount: amounts.amount0,
            token1Amount: amounts.amount1,
            uncollectedFees0: ethers.formatUnits(tokensOwed0, token0Info.decimals),
            uncollectedFees1: ethers.formatUnits(tokensOwed1, token1Info.decimals),
            lastUpdated: new Date()
          };
          
          positions.push(position);
          
          console.log(`✅ Processed position #${tokenId}: ${token0Info.symbol}/${token1Info.symbol} - ${inRange ? 'IN RANGE' : 'OUT OF RANGE'}`);
          
        } catch (error) {
          console.error(`❌ Error processing position ${i}:`, error);
          continue;
        }
      }
      
      console.log(`🎯 Successfully fetched ${positions.length} Aerodrome positions`);
      return positions;
      
    } catch (error) {
      console.error('❌ Error fetching Aerodrome positions:', error);
      throw error;
    }
  }

  // Get pool information
  async getPoolInfo(token0: string, token1: string, fee: number) {
    await this.initializeProvider();
    
    const poolAddress = await this.getPool(token0, token1, fee);
    if (poolAddress === ethers.ZeroAddress) return null;
    
    const poolState = await this.getPoolState(poolAddress);
    if (!poolState) return null;
    
    const [token0Info, token1Info] = await Promise.all([
      this.getTokenInfo(poolState.token0),
      this.getTokenInfo(poolState.token1)
    ]);
    
    return {
      address: poolAddress,
      token0: token0Info,
      token1: token1Info,
      fee: poolState.fee / 10000,
      currentTick: poolState.currentTick,
      currentPrice: this.sqrtPriceX96ToPrice(
        poolState.sqrtPriceX96,
        token0Info.decimals,
        token1Info.decimals
      )
    };
  }
}

export default AerodromePositionFetcher;
