import { dataCache, cacheHelpers, CACHE_KEYS } from './data-cache';

// Moralis API Configuration
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

// Supported chains by Moralis
export const MORALIS_CHAINS = {
  BASE: '0x2105', // Base mainnet
  ETHEREUM: '0x1', // Ethereum mainnet
  ARBITRUM: '0xa4b1', // Arbitrum One
  POLYGON: '0x89', // Polygon mainnet
  SOLANA: 'solana', // Solana mainnet
} as const;

// Token balance interface
interface TokenBalance {
  token_address: string;
  symbol: string;
  name: string;
  logo?: string;
  thumbnail?: string;
  decimals: number;
  balance: string;
  possible_spam: boolean;
  verified_contract: boolean;
  balance_formatted: string;
  usd_price?: number;
  usd_value?: number;
  native_token: boolean;
  portfolio_percentage?: number;
}

// NFT position interface (for LP tokens represented as NFTs)
interface NFTPosition {
  token_address: string;
  token_id: string;
  contract_type: string;
  owner_of: string;
  last_metadata_sync: string;
  last_token_uri_sync: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  block_number: string;
  block_number_minted: string;
  name: string;
  symbol: string;
  token_hash: string;
  token_uri?: string;
  minter_address?: string;
  verified_collection: boolean;
  possible_spam: boolean;
}

// DeFi position interface
interface DeFiPosition {
  protocol_name: string;
  protocol_logo?: string;
  protocol_url?: string;
  position_details: {
    supply_balances?: TokenBalance[];
    reward_balances?: TokenBalance[];
    borrow_balances?: TokenBalance[];
  };
  position_type: 'supply' | 'borrow' | 'liquidity' | 'stake' | 'farm';
  total_usd_value: number;
}

// Liquidity pair data
interface LiquidityPair {
  pair_address: string;
  base_token: {
    token_address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  quote_token: {
    token_address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  price_usd?: string;
  price_native?: string;
  exchange_name: string;
  exchange_address: string;
  total_supply: string;
  reserve_base: string;
  reserve_quote: string;
  liquidity_usd?: string;
}

// Solana token balance interface
interface SolanaTokenBalance {
  mint: string;
  associatedTokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  amount: string;
  amountRaw: string;
  usdValue?: number;
}

class MoralisAPI {
  private baseHeaders = {
    'Accept': 'application/json',
    'X-API-Key': MORALIS_API_KEY || '',
  };

  // EVM Chains: Get wallet token balances
  async getWalletTokenBalances(walletAddress: string, chainId: string): Promise<TokenBalance[]> {
    const cacheKey = `moralis_tokens_${chainId}_${walletAddress}`;
    
    try {
      const cached = dataCache.get<TokenBalance[]>(cacheKey);
      if (cached) {
        console.log(`✅ Using cached Moralis token balances for ${chainId}`);
        return cached.data;
      }

      const response = await fetch(
        `${MORALIS_BASE_URL}/${walletAddress}/erc20?chain=${chainId}&exclude_spam=true`,
        {
          headers: this.baseHeaders,
        }
      );

      if (!response.ok) {
        throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const tokenBalances = data.result || [];

      dataCache.set(cacheKey, tokenBalances, 'Moralis EVM API');
      console.log(`📦 Fetched ${tokenBalances.length} tokens for ${chainId} from Moralis`);
      
      return tokenBalances;
    } catch (error) {
      console.error(`❌ Error fetching token balances for ${chainId}:`, error);
      return [];
    }
  }

  // EVM Chains: Get wallet NFTs (for LP position NFTs like Uniswap V3)
  async getWalletNFTs(walletAddress: string, chainId: string): Promise<NFTPosition[]> {
    const cacheKey = `moralis_nfts_${chainId}_${walletAddress}`;
    
    try {
      const cached = dataCache.get<NFTPosition[]>(cacheKey);
      if (cached) {
        console.log(`✅ Using cached Moralis NFTs for ${chainId}`);
        return cached.data;
      }

      const response = await fetch(
        `${MORALIS_BASE_URL}/${walletAddress}/nft?chain=${chainId}&format=decimal&exclude_spam=true`,
        {
          headers: this.baseHeaders,
        }
      );

      if (!response.ok) {
        throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const nfts = data.result || [];

      dataCache.set(cacheKey, nfts, 'Moralis EVM NFT API');
      console.log(`📦 Fetched ${nfts.length} NFTs for ${chainId} from Moralis`);
      
      return nfts;
    } catch (error) {
      console.error(`❌ Error fetching NFTs for ${chainId}:`, error);
      return [];
    }
  }

  // EVM Chains: Get DeFi positions
  async getWalletDeFiPositions(walletAddress: string, chainId: string): Promise<DeFiPosition[]> {
    const cacheKey = `moralis_defi_${chainId}_${walletAddress}`;
    
    try {
      const cached = dataCache.get<DeFiPosition[]>(cacheKey);
      if (cached) {
        console.log(`✅ Using cached Moralis DeFi positions for ${chainId}`);
        return cached.data;
      }

      // Note: DeFi positions endpoint might be different based on Moralis API version
      // This is a placeholder - we'll need to check exact endpoint
      const response = await fetch(
        `${MORALIS_BASE_URL}/${walletAddress}/defi/positions?chain=${chainId}`,
        {
          headers: this.baseHeaders,
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`ℹ️ DeFi positions endpoint not available for ${chainId}`);
          return [];
        }
        throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const positions = data.result || [];

      dataCache.set(cacheKey, positions, 'Moralis DeFi API');
      console.log(`📦 Fetched ${positions.length} DeFi positions for ${chainId} from Moralis`);
      
      return positions;
    } catch (error) {
      console.error(`❌ Error fetching DeFi positions for ${chainId}:`, error);
      return [];
    }
  }

  // Solana: Get wallet token balances
  async getSolanaTokenBalances(walletAddress: string): Promise<SolanaTokenBalance[]> {
    const cacheKey = `moralis_solana_tokens_${walletAddress}`;
    
    try {
      const cached = dataCache.get<SolanaTokenBalance[]>(cacheKey);
      if (cached) {
        console.log(`✅ Using cached Moralis Solana token balances`);
        return cached.data;
      }

      // Try the correct Solana endpoint format
      const response = await fetch(
        `https://solana-gateway.moralis.io/account/mainnet/${walletAddress}/tokens`,
        {
          headers: this.baseHeaders,
        }
      );

      if (!response.ok) {
        // If the Solana endpoint is not available, log and return empty array
        console.log(`ℹ️ Moralis Solana endpoint not available: ${response.status} ${response.statusText}`);
        console.log(`ℹ️ Solana token detection will use existing integrations (Helius)`);
        return [];
      }

      const data = await response.json();
      const tokens = data.tokens || data.result || [];

      dataCache.set(cacheKey, tokens, 'Moralis Solana API');
      console.log(`📦 Fetched ${tokens.length} Solana tokens from Moralis`);
      
      return tokens;
    } catch (error) {
      console.error(`❌ Error fetching Solana token balances:`, error);
      console.log(`ℹ️ Falling back to existing Solana integrations (Helius, Orca, Raydium)`);
      return [];
    }
  }

  // Get token pair information
  async getTokenPairInfo(pairAddress: string, chainId: string): Promise<LiquidityPair | null> {
    const cacheKey = `moralis_pair_${chainId}_${pairAddress}`;
    
    try {
      const cached = dataCache.get<LiquidityPair>(cacheKey);
      if (cached) {
        console.log(`✅ Using cached Moralis pair info for ${pairAddress}`);
        return cached.data;
      }

      const response = await fetch(
        `${MORALIS_BASE_URL}/erc20/${pairAddress}/pairs?chain=${chainId}`,
        {
          headers: this.baseHeaders,
        }
      );

      if (!response.ok) {
        throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const pairInfo = data.result?.[0] || null;

      if (pairInfo) {
        dataCache.set(cacheKey, pairInfo, 'Moralis Pairs API');
        console.log(`📦 Fetched pair info for ${pairAddress} from Moralis`);
      }
      
      return pairInfo;
    } catch (error) {
      console.error(`❌ Error fetching pair info for ${pairAddress}:`, error);
      return null;
    }
  }

  // Helper: Filter LP tokens from token balances
  filterLPTokens(tokens: TokenBalance[]): TokenBalance[] {
    return tokens.filter(token => {
      const name = token.name?.toLowerCase() || '';
      const symbol = token.symbol?.toLowerCase() || '';
      
      return (
        // Common LP token patterns
        name.includes('liquidity') ||
        name.includes('lp token') ||
        name.includes('uniswap') ||
        name.includes('aerodrome') ||
        name.includes('pancake') ||
        symbol.includes('-lp') ||
        symbol.includes('lp-') ||
        symbol.includes('uni-v') ||
        symbol.includes('slp') ||
        // Check if it's a token pair (contains slash or dash)
        (symbol.includes('/') || symbol.includes('-')) &&
        !token.native_token
      );
    });
  }

  // Helper: Filter potential LP NFTs
  filterLPNFTs(nfts: NFTPosition[]): NFTPosition[] {
    return nfts.filter(nft => {
      const name = nft.name?.toLowerCase() || '';
      const symbol = nft.symbol?.toLowerCase() || '';
      const contractAddress = nft.token_address?.toLowerCase() || '';
      
      return (
        // Uniswap V3 positions
        name.includes('uniswap') ||
        name.includes('position') ||
        symbol.includes('uni-v3') ||
        // Aerodrome positions
        name.includes('aerodrome') ||
        symbol.includes('aero') ||
        // Check known LP NFT contracts (these would need to be chain-specific)
        this.isKnownLPContract(contractAddress, nft.contract_type)
      );
    });
  }

  // Helper: Check if contract is a known LP NFT contract
  private isKnownLPContract(contractAddress: string, contractType: string): boolean {
    const knownLPContracts = {
      // Uniswap V3 Position Manager
      '0xc36442b4a4522e871399cd717abdd847ab11fe88': 'Uniswap V3',
      // Aerodrome Position Manager (Base)
      '0x827922686190790b37229fd06084350e74485b72': 'Aerodrome',
    };
    
    return contractAddress in knownLPContracts && contractType === 'ERC721';
  }
}

// Export singleton instance
export const moralisAPI = new MoralisAPI();

// High-level functions for the DN_Model app
export const moralisHelpers = {
  // Get comprehensive LP data for a wallet across all supported chains
  async getAllLPPositions(walletAddress: string) {
    const results = {
      base: { tokens: [] as TokenBalance[], nfts: [] as NFTPosition[], defi: [] as DeFiPosition[] },
      ethereum: { tokens: [] as TokenBalance[], nfts: [] as NFTPosition[], defi: [] as DeFiPosition[] },
      arbitrum: { tokens: [] as TokenBalance[], nfts: [] as NFTPosition[], defi: [] as DeFiPosition[] },
      solana: { tokens: [] as SolanaTokenBalance[] },
      summary: {
        totalLPTokens: 0,
        totalNFTPositions: 0,
        totalDeFiPositions: 0,
        chainsCovered: [] as string[],
        lastUpdated: new Date(),
      }
    };

    try {
      console.log(`🔍 Scanning LP positions for wallet: ${walletAddress}`);

      // Base chain
      const [baseTokens, baseNFTs, baseDefi] = await Promise.all([
        moralisAPI.getWalletTokenBalances(walletAddress, MORALIS_CHAINS.BASE),
        moralisAPI.getWalletNFTs(walletAddress, MORALIS_CHAINS.BASE),
        moralisAPI.getWalletDeFiPositions(walletAddress, MORALIS_CHAINS.BASE),
      ]);

      results.base.tokens = moralisAPI.filterLPTokens(baseTokens);
      results.base.nfts = moralisAPI.filterLPNFTs(baseNFTs);
      results.base.defi = baseDefi;

      // Ethereum chain
      const [ethTokens, ethNFTs, ethDefi] = await Promise.all([
        moralisAPI.getWalletTokenBalances(walletAddress, MORALIS_CHAINS.ETHEREUM),
        moralisAPI.getWalletNFTs(walletAddress, MORALIS_CHAINS.ETHEREUM),
        moralisAPI.getWalletDeFiPositions(walletAddress, MORALIS_CHAINS.ETHEREUM),
      ]);

      results.ethereum.tokens = moralisAPI.filterLPTokens(ethTokens);
      results.ethereum.nfts = moralisAPI.filterLPNFTs(ethNFTs);
      results.ethereum.defi = ethDefi;

      // Arbitrum chain
      const [arbTokens, arbNFTs, arbDefi] = await Promise.all([
        moralisAPI.getWalletTokenBalances(walletAddress, MORALIS_CHAINS.ARBITRUM),
        moralisAPI.getWalletNFTs(walletAddress, MORALIS_CHAINS.ARBITRUM),
        moralisAPI.getWalletDeFiPositions(walletAddress, MORALIS_CHAINS.ARBITRUM),
      ]);

      results.arbitrum.tokens = moralisAPI.filterLPTokens(arbTokens);
      results.arbitrum.nfts = moralisAPI.filterLPNFTs(arbNFTs);
      results.arbitrum.defi = arbDefi;

      // Calculate summary
      results.summary.totalLPTokens = 
        results.base.tokens.length + 
        results.ethereum.tokens.length + 
        results.arbitrum.tokens.length;
      
      results.summary.totalNFTPositions = 
        results.base.nfts.length + 
        results.ethereum.nfts.length + 
        results.arbitrum.nfts.length;
      
      results.summary.totalDeFiPositions = 
        results.base.defi.length + 
        results.ethereum.defi.length + 
        results.arbitrum.defi.length;

      results.summary.chainsCovered = ['base', 'ethereum', 'arbitrum'];

      console.log(`✅ LP position scan complete:`, {
        lpTokens: results.summary.totalLPTokens,
        nftPositions: results.summary.totalNFTPositions,
        defiPositions: results.summary.totalDeFiPositions,
      });

      return results;

    } catch (error) {
      console.error('❌ Error scanning LP positions:', error);
      return results;
    }
  },

  // Get Solana LP positions (separate due to different API structure)
  async getSolanaLPPositions(walletAddress: string) {
    try {
      console.log(`🔍 Scanning Solana LP positions for wallet: ${walletAddress}`);
      
      const tokens = await moralisAPI.getSolanaTokenBalances(walletAddress);
      
      // Filter for potential LP tokens on Solana
      const lpTokens = tokens.filter(token => {
        const name = token.name?.toLowerCase() || '';
        const symbol = token.symbol?.toLowerCase() || '';
        
        return (
          name.includes('liquidity') ||
          name.includes('lp') ||
          name.includes('raydium') ||
          name.includes('orca') ||
          name.includes('whirlpool') ||
          symbol.includes('lp') ||
          symbol.includes('-') ||
          symbol.includes('/')
        );
      });

      console.log(`✅ Found ${lpTokens.length} potential LP tokens on Solana`);
      
      return {
        tokens: lpTokens,
        totalTokens: tokens.length,
        potentialLPTokens: lpTokens.length,
        lastUpdated: new Date(),
      };

    } catch (error) {
      console.error('❌ Error scanning Solana LP positions:', error);
      return {
        tokens: [],
        totalTokens: 0,
        potentialLPTokens: 0,
        lastUpdated: new Date(),
      };
    }
  },
};