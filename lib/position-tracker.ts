import { ethers } from 'ethers';
import { Token, CurrencyAmount } from '@uniswap/sdk-core';
import { Position, Pool } from '@uniswap/v3-sdk';

// ABIs for Uniswap V3 contracts
const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
];

const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function fee() external view returns (uint24)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function tickSpacing() external view returns (int24)',
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
];

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

// Contract addresses
const POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'; // Uniswap V3 NonfungiblePositionManager

export interface PositionData {
  tokenId: string;
  owner: string;
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
  liquidity: string;
  amount0: string;
  amount1: string;
  uncollectedFees0: string;
  uncollectedFees1: string;
  currentPrice: number;
  priceRange: {
    lower: number;
    upper: number;
  };
  inRange: boolean;
  valueUSD: number;
  delta: number; // Token0 exposure
  gamma: number; // Position curvature
}

export interface PoolState {
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  fee: number;
}

export class UniswapV3PositionTracker {
  private provider: ethers.Provider;
  private positionManager: ethers.Contract;
  private poolCache: Map<string, ethers.Contract> = new Map();
  private tokenCache: Map<string, any> = new Map();

  constructor(rpcUrl: string = 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.positionManager = new ethers.Contract(
      POSITION_MANAGER_ADDRESS,
      POSITION_MANAGER_ABI,
      this.provider
    );
  }

  /**
   * Get comprehensive position data for a given NFT token ID
   */
  async getPosition(tokenId: string | number): Promise<PositionData> {
    try {
      // Fetch position data from NFT
      const position = await this.positionManager.positions(tokenId);
      const owner = await this.positionManager.ownerOf(tokenId);

      // Get token metadata
      const token0Data = await this.getTokenData(position.token0);
      const token1Data = await this.getTokenData(position.token1);

      // Get pool contract
      const poolAddress = await this.computePoolAddress(
        position.token0,
        position.token1,
        position.fee
      );
      const pool = await this.getPool(poolAddress);
      
      // Get current pool state
      const slot0 = await pool.slot0();
      const poolLiquidity = await pool.liquidity();

      // Calculate current amounts
      const amounts = this.calculateAmounts(
        position.liquidity,
        slot0.sqrtPriceX96,
        position.tickLower,
        position.tickUpper
      );

      // Calculate prices
      const currentPrice = this.sqrtPriceX96ToPrice(
        slot0.sqrtPriceX96,
        token0Data.decimals,
        token1Data.decimals
      );

      const lowerPrice = this.tickToPrice(
        position.tickLower,
        token0Data.decimals,
        token1Data.decimals
      );

      const upperPrice = this.tickToPrice(
        position.tickUpper,
        token0Data.decimals,
        token1Data.decimals
      );

      // Check if position is in range
      const inRange = slot0.tick >= position.tickLower && slot0.tick < position.tickUpper;

      // Calculate Greeks
      const delta = parseFloat(amounts.amount0);
      const gamma = this.calculateGamma(
        position.liquidity,
        slot0.sqrtPriceX96,
        inRange
      );

      // Estimate USD value (would need price oracle for accurate USD)
      const valueUSD = this.estimateValueUSD(
        amounts.amount0,
        amounts.amount1,
        token0Data.symbol,
        token1Data.symbol,
        currentPrice
      );

      return {
        tokenId: tokenId.toString(),
        owner,
        token0: token0Data,
        token1: token1Data,
        fee: position.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        liquidity: position.liquidity.toString(),
        amount0: amounts.amount0,
        amount1: amounts.amount1,
        uncollectedFees0: ethers.formatUnits(position.tokensOwed0, token0Data.decimals),
        uncollectedFees1: ethers.formatUnits(position.tokensOwed1, token1Data.decimals),
        currentPrice,
        priceRange: {
          lower: lowerPrice,
          upper: upperPrice,
        },
        inRange,
        valueUSD,
        delta,
        gamma,
      };
    } catch (error) {
      console.error('Error fetching position:', error);
      throw error;
    }
  }

  /**
   * Calculate token amounts for a position
   */
  private calculateAmounts(
    liquidity: bigint,
    sqrtPriceX96: bigint,
    tickLower: number,
    tickUpper: number
  ): { amount0: string; amount1: string } {
    const sqrtRatioA = this.getSqrtRatioAtTick(tickLower);
    const sqrtRatioB = this.getSqrtRatioAtTick(tickUpper);

    let amount0 = 0n;
    let amount1 = 0n;

    if (sqrtPriceX96 <= sqrtRatioA) {
      // Current price is below range
      amount0 = this.getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
      amount1 = 0n;
    } else if (sqrtPriceX96 < sqrtRatioB) {
      // Current price is inside range
      amount0 = this.getAmount0Delta(sqrtPriceX96, sqrtRatioB, liquidity, true);
      amount1 = this.getAmount1Delta(sqrtRatioA, sqrtPriceX96, liquidity, true);
    } else {
      // Current price is above range
      amount0 = 0n;
      amount1 = this.getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
    }

    // Convert to decimal strings (simplified - needs proper decimal handling)
    return {
      amount0: (amount0 / 10n**12n).toString(), // Rough conversion
      amount1: (amount1 / 10n**12n).toString(), // Rough conversion
    };
  }

  /**
   * Calculate amount0 delta
   */
  private getAmount0Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    const numerator1 = liquidity << 96n;
    const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;

    return (numerator1 * numerator2) / sqrtRatioBX96 / sqrtRatioAX96;
  }

  /**
   * Calculate amount1 delta
   */
  private getAmount1Delta(
    sqrtRatioAX96: bigint,
    sqrtRatioBX96: bigint,
    liquidity: bigint,
    roundUp: boolean
  ): bigint {
    if (sqrtRatioAX96 > sqrtRatioBX96) {
      [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
    }

    return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) >> 96n;
  }

  /**
   * Get sqrt price at tick
   */
  private getSqrtRatioAtTick(tick: number): bigint {
    const absTick = tick < 0 ? -tick : tick;
    
    let ratio = (absTick & 0x1) !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;

    if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
    if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
    if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
    if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
    if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
    if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
    if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
    if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
    if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
    if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
    if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
    if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
    if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
    if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
    if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
    if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
    if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
    if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
    if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

    if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;

    return ratio >> 32n;
  }

  /**
   * Calculate gamma (position curvature)
   */
  private calculateGamma(
    liquidity: bigint,
    sqrtPriceX96: bigint,
    inRange: boolean
  ): number {
    if (!inRange) return 0;
    
    // Gamma = -L / (2 * s^3) where s = sqrt(P)
    // Simplified calculation
    const sqrtPrice = Number(sqrtPriceX96) / Number(2n ** 96n);
    const gamma = -Number(liquidity) / (2 * Math.pow(sqrtPrice, 3));
    
    return gamma / 1e18; // Normalize
  }

  /**
   * Convert sqrtPriceX96 to human readable price
   */
  private sqrtPriceX96ToPrice(
    sqrtPriceX96: bigint,
    decimals0: number,
    decimals1: number
  ): number {
    const price = (Number(sqrtPriceX96) / Number(2n ** 96n)) ** 2;
    return price * (10 ** (decimals0 - decimals1));
  }

  /**
   * Convert tick to price
   */
  private tickToPrice(
    tick: number,
    decimals0: number,
    decimals1: number
  ): number {
    const price = Math.pow(1.0001, tick);
    return price * (10 ** (decimals0 - decimals1));
  }

  /**
   * Compute pool address
   */
  private async computePoolAddress(
    token0: string,
    token1: string,
    fee: number
  ): string {
    // Uniswap V3 factory address
    const FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
    
    // Order tokens
    const [tokenA, tokenB] = token0.toLowerCase() < token1.toLowerCase() 
      ? [token0, token1] 
      : [token1, token0];

    // Compute CREATE2 address (simplified - use Uniswap SDK in production)
    const salt = ethers.solidityPackedKeccak256(
      ['address', 'address', 'uint24'],
      [tokenA, tokenB, fee]
    );

    const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
    
    const address = ethers.getCreate2Address(
      FACTORY,
      salt,
      POOL_INIT_CODE_HASH
    );

    return address;
  }

  /**
   * Get or create pool contract instance
   */
  private async getPool(address: string): Promise<ethers.Contract> {
    if (!this.poolCache.has(address)) {
      const pool = new ethers.Contract(address, POOL_ABI, this.provider);
      this.poolCache.set(address, pool);
    }
    return this.poolCache.get(address)!;
  }

  /**
   * Get token metadata
   */
  private async getTokenData(address: string): Promise<any> {
    if (!this.tokenCache.has(address)) {
      const token = new ethers.Contract(address, ERC20_ABI, this.provider);
      const [symbol, decimals] = await Promise.all([
        token.symbol(),
        token.decimals(),
      ]);
      
      const data = { address, symbol, decimals: Number(decimals) };
      this.tokenCache.set(address, data);
    }
    return this.tokenCache.get(address);
  }

  /**
   * Estimate USD value (simplified - would need price oracle)
   */
  private estimateValueUSD(
    amount0: string,
    amount1: string,
    symbol0: string,
    symbol1: string,
    currentPrice: number
  ): number {
    // Simplified USD estimation
    // In production, use Chainlink or other price oracles
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX'];
    
    if (stablecoins.includes(symbol1)) {
      // Token1 is USD
      const value0InToken1 = parseFloat(amount0) * currentPrice;
      return value0InToken1 + parseFloat(amount1);
    } else if (stablecoins.includes(symbol0)) {
      // Token0 is USD
      const value1InToken0 = parseFloat(amount1) / currentPrice;
      return parseFloat(amount0) + value1InToken0;
    }
    
    // Need external price data for non-stable pairs
    return 0;
  }

  /**
   * Monitor position with real-time updates
   */
  async monitorPosition(
    tokenId: string,
    callback: (data: PositionData) => void,
    interval: number = 5000
  ): Promise<() => void> {
    // Initial fetch
    const position = await this.getPosition(tokenId);
    callback(position);

    // Get pool for events
    const poolAddress = await this.computePoolAddress(
      position.token0.address,
      position.token1.address,
      position.fee
    );
    const pool = await this.getPool(poolAddress);

    // Listen to swap events for real-time price updates
    const handleSwap = async () => {
      const updatedPosition = await this.getPosition(tokenId);
      callback(updatedPosition);
    };

    pool.on('Swap', handleSwap);

    // Periodic updates
    const timer = setInterval(async () => {
      try {
        const updatedPosition = await this.getPosition(tokenId);
        callback(updatedPosition);
      } catch (error) {
        console.error('Error updating position:', error);
      }
    }, interval);

    // Return cleanup function
    return () => {
      pool.off('Swap', handleSwap);
      clearInterval(timer);
    };
  }

  /**
   * Get multiple positions for an owner
   */
  async getPositionsByOwner(owner: string, limit: number = 100): Promise<PositionData[]> {
    // Would need to query events or use The Graph for this
    // Simplified version - just returning empty array
    console.log('Getting positions for owner:', owner);
    return [];
  }
}

// Export singleton instance
export const positionTracker = new UniswapV3PositionTracker();