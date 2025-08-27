import { Connection, PublicKey } from '@solana/web3.js';
import { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PoolUtil, PriceMath } from '@orca-so/whirlpools-sdk';
import { AnchorProvider } from '@coral-xyz/anchor';
import Decimal from 'decimal.js';

// Raydium CLMM Program ID
const RAYDIUM_CLMM_PROGRAM_ID = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');

// Orca Whirlpool Program ID is already exported from SDK

export interface SolanaPositionData {
  positionAddress: string;
  protocol: 'raydium' | 'orca';
  owner: string;
  pool: {
    address: string;
    token0: {
      address: string;
      symbol: string;
      decimals: number;
      name: string;
    };
    token1: {
      address: string;
      symbol: string;
      decimals: number;
      name: string;
    };
    fee: number;
    tickSpacing: number;
  };
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amounts: {
    token0: string;
    token1: string;
  };
  rewards: {
    token0: string;
    token1: string;
  };
  fees: {
    token0: string;
    token1: string;
  };
  currentPrice: number;
  priceRange: {
    lower: number;
    upper: number;
  };
  inRange: boolean;
  delta: number;
  gamma: number;
}

export class SolanaPositionTracker {
  private connection: Connection;
  private whirlpoolClient: any;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Initialize Orca Whirlpool client
   */
  private async initWhirlpoolClient() {
    if (this.whirlpoolClient) return this.whirlpoolClient;

    // Create a dummy wallet for read-only operations
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async () => { throw new Error('Read-only'); },
      signAllTransactions: async () => { throw new Error('Read-only'); },
    };

    const provider = new AnchorProvider(
      this.connection,
      dummyWallet as any,
      { commitment: 'confirmed' }
    );

    const ctx = WhirlpoolContext.from(
      this.connection,
      dummyWallet as any,
      ORCA_WHIRLPOOL_PROGRAM_ID
    );

    this.whirlpoolClient = buildWhirlpoolClient(ctx);
    return this.whirlpoolClient;
  }

  /**
   * Detect protocol from position address
   */
  private async detectProtocol(positionAddress: string): Promise<'raydium' | 'orca' | 'unknown'> {
    try {
      const pubkey = new PublicKey(positionAddress);
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      
      if (!accountInfo) {
        console.log('Account not found:', positionAddress);
        throw new Error('Account not found on Solana');
      }

      console.log('Account owner:', accountInfo.owner.toBase58());
      console.log('Account data length:', accountInfo.data.length);

      // Check if it's an Orca position by checking the owner program
      if (accountInfo.owner.equals(ORCA_WHIRLPOOL_PROGRAM_ID)) {
        console.log('Detected as Orca position');
        return 'orca';
      }
      
      // Check if it's a Raydium position
      if (accountInfo.owner.equals(RAYDIUM_CLMM_PROGRAM_ID)) {
        console.log('Detected as Raydium position');
        return 'raydium';
      }

      // Check if it's an NFT (position might be represented as NFT)
      const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const METAPLEX_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      
      if (accountInfo.owner.equals(TOKEN_PROGRAM)) {
        console.log('This is a token account, might be position NFT');
        // Try to get the mint and check if it's a position NFT
        return 'unknown';
      }

      if (accountInfo.owner.equals(METAPLEX_PROGRAM)) {
        console.log('This is a Metaplex metadata account');
        return 'unknown';
      }

      console.log('Unknown account type with owner:', accountInfo.owner.toBase58());
      return 'unknown';
    } catch (error) {
      console.error('Error detecting protocol:', error);
      return 'unknown';
    }
  }

  /**
   * Fetch Orca Whirlpool position
   */
  private async fetchOrcaPosition(positionAddress: string): Promise<SolanaPositionData> {
    try {
      const client = await this.initWhirlpoolClient();
      const positionPubkey = new PublicKey(positionAddress);

      // Get position data
      const position = await client.getPosition(positionPubkey);
      if (!position) {
        throw new Error('Position not found');
      }

      // Get whirlpool (pool) data
      const whirlpool = await client.getPool(position.getData().whirlpool);
      if (!whirlpool) {
        throw new Error('Pool not found');
      }

      const positionData = position.getData();
      const whirlpoolData = whirlpool.getData();

      // Get token metadata
      const tokenA = whirlpool.getTokenAInfo();
      const tokenB = whirlpool.getTokenBInfo();

      // Calculate current amounts
      const amounts = PoolUtil.getTokenAmountsFromLiquidity(
        positionData.liquidity,
        whirlpoolData.sqrtPrice,
        PriceMath.tickIndexToSqrtPriceX64(positionData.tickLowerIndex),
        PriceMath.tickIndexToSqrtPriceX64(positionData.tickUpperIndex),
        true
      );

      // Calculate prices
      const currentPrice = PriceMath.sqrtPriceX64ToPrice(
        whirlpoolData.sqrtPrice,
        tokenA.decimals,
        tokenB.decimals
      );

      const lowerPrice = PriceMath.tickIndexToPrice(
        positionData.tickLowerIndex,
        tokenA.decimals,
        tokenB.decimals
      );

      const upperPrice = PriceMath.tickIndexToPrice(
        positionData.tickUpperIndex,
        tokenA.decimals,
        tokenB.decimals
      );

      // Check if position is in range
      const currentTick = PriceMath.sqrtPriceX64ToTickIndex(whirlpoolData.sqrtPrice);
      const inRange = currentTick >= positionData.tickLowerIndex && 
                     currentTick < positionData.tickUpperIndex;

      // Calculate Greeks
      const delta = amounts.tokenA.toNumber() / Math.pow(10, tokenA.decimals);
      const gamma = this.calculateGamma(
        positionData.liquidity.toString(),
        whirlpoolData.sqrtPrice.toString(),
        inRange
      );

      // Get rewards and fees
      const rewards = await position.getRewardInfos();
      const fees = positionData.feeGrowthCheckpointA.sub(positionData.feeGrowthCheckpointB);

      return {
        positionAddress,
        protocol: 'orca',
        owner: position.getData().positionMint.toString(),
        pool: {
          address: whirlpool.getAddress().toString(),
          token0: {
            address: tokenA.mint.toString(),
            symbol: tokenA.symbol || 'Unknown',
            decimals: tokenA.decimals,
            name: tokenA.name || 'Unknown Token',
          },
          token1: {
            address: tokenB.mint.toString(),
            symbol: tokenB.symbol || 'Unknown',
            decimals: tokenB.decimals,
            name: tokenB.name || 'Unknown Token',
          },
          fee: whirlpoolData.feeRate,
          tickSpacing: whirlpoolData.tickSpacing,
        },
        tickLower: positionData.tickLowerIndex,
        tickUpper: positionData.tickUpperIndex,
        liquidity: positionData.liquidity.toString(),
        amounts: {
          token0: (amounts.tokenA.toNumber() / Math.pow(10, tokenA.decimals)).toFixed(6),
          token1: (amounts.tokenB.toNumber() / Math.pow(10, tokenB.decimals)).toFixed(6),
        },
        rewards: {
          token0: '0',
          token1: '0',
        },
        fees: {
          token0: (positionData.feeOwedA.toNumber() / Math.pow(10, tokenA.decimals)).toFixed(6),
          token1: (positionData.feeOwedB.toNumber() / Math.pow(10, tokenB.decimals)).toFixed(6),
        },
        currentPrice: currentPrice.toNumber(),
        priceRange: {
          lower: lowerPrice.toNumber(),
          upper: upperPrice.toNumber(),
        },
        inRange,
        delta,
        gamma,
      };
    } catch (error) {
      console.error('Error fetching Orca position:', error);
      throw error;
    }
  }

  /**
   * Fetch Raydium CLMM position
   */
  private async fetchRaydiumPosition(positionAddress: string): Promise<SolanaPositionData> {
    try {
      const positionPubkey = new PublicKey(positionAddress);
      
      // Get position account data
      const accountInfo = await this.connection.getAccountInfo(positionPubkey);
      if (!accountInfo) {
        throw new Error('Position not found');
      }

      // Raydium CLMM position structure (simplified)
      // This would need the actual Raydium IDL for proper decoding
      const data = accountInfo.data;
      
      // Parse position data (this is a simplified example)
      // In production, you'd use Raydium's SDK or IDL
      const positionData = this.parseRaydiumPosition(data);

      return {
        positionAddress,
        protocol: 'raydium',
        owner: 'Unknown', // Would need to parse from data
        pool: {
          address: 'Unknown',
          token0: {
            address: 'Unknown',
            symbol: 'TOKEN0',
            decimals: 9,
            name: 'Unknown Token',
          },
          token1: {
            address: 'Unknown',
            symbol: 'TOKEN1',
            decimals: 9,
            name: 'Unknown Token',
          },
          fee: 0,
          tickSpacing: 0,
        },
        tickLower: 0,
        tickUpper: 0,
        liquidity: '0',
        amounts: {
          token0: '0',
          token1: '0',
        },
        rewards: {
          token0: '0',
          token1: '0',
        },
        fees: {
          token0: '0',
          token1: '0',
        },
        currentPrice: 0,
        priceRange: {
          lower: 0,
          upper: 0,
        },
        inRange: false,
        delta: 0,
        gamma: 0,
      };
    } catch (error) {
      console.error('Error fetching Raydium position:', error);
      throw error;
    }
  }

  /**
   * Parse Raydium position data (placeholder)
   */
  private parseRaydiumPosition(data: Buffer): any {
    // This would need proper Raydium IDL parsing
    // For now, return dummy data
    return {
      liquidity: 0,
      tickLower: 0,
      tickUpper: 0,
    };
  }

  /**
   * Calculate gamma
   */
  private calculateGamma(liquidity: string, sqrtPrice: string, inRange: boolean): number {
    if (!inRange) return 0;
    
    const L = new Decimal(liquidity);
    const s = new Decimal(sqrtPrice).div(new Decimal(2).pow(64));
    
    // Gamma = -L / (2 * s^3)
    const gamma = L.neg().div(s.pow(3).mul(2));
    
    return gamma.div(1e18).toNumber();
  }

  /**
   * Try to find position NFT from token account
   */
  private async findPositionFromTokenAccount(tokenAccount: string): Promise<string | null> {
    try {
      const pubkey = new PublicKey(tokenAccount);
      const accountInfo = await this.connection.getParsedAccountInfo(pubkey);
      
      if (accountInfo.value && 'parsed' in accountInfo.value.data) {
        const parsed = accountInfo.value.data.parsed;
        if (parsed.type === 'account' && parsed.info.mint) {
          console.log('Found mint address:', parsed.info.mint);
          // The mint might be the position NFT
          return parsed.info.mint;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding position from token account:', error);
      return null;
    }
  }

  /**
   * Main method to fetch any Solana position
   */
  async getPosition(positionAddress: string): Promise<SolanaPositionData> {
    console.log('Attempting to fetch position:', positionAddress);
    
    // First, detect what type of account this is
    let protocol = await this.detectProtocol(positionAddress);
    let actualPositionAddress = positionAddress;
    
    // If unknown, try to find the actual position
    if (protocol === 'unknown') {
      console.log('Unknown account type, trying to find position NFT...');
      
      // Check if this is a token account that holds a position NFT
      const mintAddress = await this.findPositionFromTokenAccount(positionAddress);
      if (mintAddress) {
        actualPositionAddress = mintAddress;
        protocol = await this.detectProtocol(mintAddress);
      }
      
      // If still unknown, try treating it as an Orca position directly
      if (protocol === 'unknown') {
        console.log('Attempting to parse as Orca position...');
        try {
          return await this.fetchOrcaPosition(positionAddress);
        } catch (orcaError) {
          console.log('Failed to parse as Orca:', orcaError);
        }
        
        console.log('Attempting to parse as Raydium position...');
        try {
          return await this.fetchRaydiumPosition(positionAddress);
        } catch (raydiumError) {
          console.log('Failed to parse as Raydium:', raydiumError);
        }
        
        throw new Error('Could not identify position type. Please ensure this is a valid Orca or Raydium CLM position.');
      }
    }
    
    if (protocol === 'orca') {
      return this.fetchOrcaPosition(actualPositionAddress);
    } else if (protocol === 'raydium') {
      return this.fetchRaydiumPosition(actualPositionAddress);
    } else {
      throw new Error('Unsupported protocol');
    }
  }

  /**
   * Monitor position with polling
   */
  async monitorPosition(
    positionAddress: string,
    callback: (data: SolanaPositionData) => void,
    interval: number = 10000
  ): Promise<() => void> {
    // Initial fetch
    const position = await this.getPosition(positionAddress);
    callback(position);

    // Set up polling
    const timer = setInterval(async () => {
      try {
        const updatedPosition = await this.getPosition(positionAddress);
        callback(updatedPosition);
      } catch (error) {
        console.error('Error updating position:', error);
      }
    }, interval);

    // Return cleanup function
    return () => {
      clearInterval(timer);
    };
  }

  /**
   * Get all positions for a wallet
   */
  async getPositionsByWallet(walletAddress: string): Promise<SolanaPositionData[]> {
    try {
      const wallet = new PublicKey(walletAddress);
      
      // Get token accounts owned by wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        wallet,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      const positions: SolanaPositionData[] = [];
      
      // Check each token account to see if it's a position NFT
      for (const account of tokenAccounts.value) {
        try {
          // Try to fetch as position
          const position = await this.getPosition(account.pubkey.toString());
          positions.push(position);
        } catch {
          // Not a position, skip
        }
      }

      return positions;
    } catch (error) {
      console.error('Error fetching positions by wallet:', error);
      return [];
    }
  }
}

// Export singleton instance with public RPC
export const solanaPositionTracker = new SolanaPositionTracker();