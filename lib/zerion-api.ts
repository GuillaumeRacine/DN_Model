// Zerion API client for comprehensive DeFi portfolio tracking
import axios from 'axios';

const ZERION_BASE_URL = 'https://api.zerion.io';
const WALLET_ADDRESS = '0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af';

interface ZerionToken {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string;
}

interface ZerionPosition {
  id: string;
  type: string; // 'wallet' | 'deposit' | 'loan' | 'liquidity' | 'staked' | 'locked'
  attributes: {
    name: string;
    value: number;
    price: number;
    changes: {
      absolute_1d: number;
      percent_1d: number;
    };
    fungible_info?: {
      quantity: string;
      icon?: string;
    };
    protocol?: {
      id: string;
      name: string;
      icon?: string;
    };
    application?: {
      id: string;
      name: string;
      icon?: string;
    };
  };
  relationships?: {
    chain: {
      data: {
        id: string;
        type: 'chains';
      };
    };
    fungible: {
      data: {
        id: string;
        type: 'fungibles';
      };
    };
  };
}

interface ZerionChain {
  id: string;
  name: string;
  icon?: string;
}

interface ZerionPortfolioResponse {
  data: ZerionPosition[];
  included?: (ZerionToken | ZerionChain)[];
  meta?: {
    total: {
      positions: number;
    };
  };
}

interface ZerionTransactionResponse {
  data: any[];
  included?: any[];
  meta?: any;
}

class ZerionAPI {
  private client: axios.AxiosInstance;

  constructor() {
    const apiKey = process.env.ZERION_API_KEY || process.env.NEXT_PUBLIC_ZERION_API_KEY;
    
    if (!apiKey) {
      throw new Error('ZERION_API_KEY not found in environment variables');
    }

    this.client = axios.create({
      baseURL: ZERION_BASE_URL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'DN_Model/1.0'
      },
      auth: {
        username: apiKey,
        password: ''
      }
    });

    console.log('✅ Zerion API client initialized');
  }

  // Get wallet portfolio positions
  async getWalletPositions(walletAddress: string = WALLET_ADDRESS): Promise<ZerionPortfolioResponse> {
    try {
      console.log(`🔍 Fetching Zerion portfolio for wallet: ${walletAddress}`);
      
      const response = await this.client.get(
        `/v1/wallets/${walletAddress}/positions/`,
        {
          params: {
            'filter[positions]': 'no_filter',
            'sort': 'value',
            'page[size]': 100
          }
        }
      );

      console.log(`✅ Successfully fetched ${response.data.data?.length || 0} positions from Zerion`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Error fetching Zerion portfolio:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
      }
      throw error;
    }
  }

  // Get wallet transactions
  async getWalletTransactions(walletAddress: string = WALLET_ADDRESS, limit = 50): Promise<ZerionTransactionResponse> {
    try {
      console.log(`🔍 Fetching Zerion transactions for wallet: ${walletAddress}`);
      
      const response = await this.client.get(
        `/v1/wallets/${walletAddress}/transactions/`,
        {
          params: {
            'page[size]': limit,
            'sort': '-mined_at'
          }
        }
      );

      console.log(`✅ Successfully fetched ${response.data.data?.length || 0} transactions from Zerion`);
      return response.data;
      
    } catch (error) {
      console.error('❌ Error fetching Zerion transactions:', error);
      throw error;
    }
  }

  // Get DeFi positions only
  async getDeFiPositions(walletAddress: string = WALLET_ADDRESS): Promise<ZerionPosition[]> {
    try {
      const portfolio = await this.getWalletPositions(walletAddress);
      
      // Filter for DeFi positions (not simple wallet holdings)
      const defiPositions = portfolio.data.filter(position => {
        const positionType = position.type;
        const hasProtocol = position.attributes.protocol || position.attributes.application;
        
        return positionType !== 'wallet' || hasProtocol;
      });

      console.log(`📊 Found ${defiPositions.length} DeFi positions out of ${portfolio.data.length} total positions`);
      
      return defiPositions;
      
    } catch (error) {
      console.error('❌ Error filtering DeFi positions:', error);
      return [];
    }
  }

  // Get portfolio summary with totals
  async getPortfolioSummary(walletAddress: string = WALLET_ADDRESS) {
    try {
      const positions = await this.getWalletPositions(walletAddress);
      
      let totalValue = 0;
      let total24hChange = 0;
      const chainBreakdown: { [key: string]: { value: number; positions: number } } = {};
      const protocolBreakdown: { [key: string]: { value: number; positions: number } } = {};
      
      // Process included data to create lookups
      const chainsMap: { [key: string]: ZerionChain } = {};
      const tokensMap: { [key: string]: ZerionToken } = {};
      
      if (positions.included) {
        positions.included.forEach(item => {
          if ('name' in item && 'symbol' in item) {
            // It's a token
            tokensMap[item.id] = item as ZerionToken;
          } else {
            // It's a chain
            chainsMap[item.id] = item as ZerionChain;
          }
        });
      }

      positions.data.forEach(position => {
        const value = position.attributes.value || 0;
        const change24h = position.attributes.changes?.absolute_1d || 0;
        
        totalValue += value;
        total24hChange += change24h;
        
        // Chain breakdown
        const chainId = position.relationships?.chain?.data?.id;
        if (chainId) {
          const chainName = chainsMap[chainId]?.name || chainId;
          if (!chainBreakdown[chainName]) {
            chainBreakdown[chainName] = { value: 0, positions: 0 };
          }
          chainBreakdown[chainName].value += value;
          chainBreakdown[chainName].positions += 1;
        }
        
        // Protocol breakdown
        const protocol = position.attributes.protocol || position.attributes.application;
        if (protocol) {
          const protocolName = protocol.name;
          if (!protocolBreakdown[protocolName]) {
            protocolBreakdown[protocolName] = { value: 0, positions: 0 };
          }
          protocolBreakdown[protocolName].value += value;
          protocolBreakdown[protocolName].positions += 1;
        }
      });

      return {
        totalValue,
        total24hChange,
        totalPositions: positions.data.length,
        chains: chainBreakdown,
        protocols: protocolBreakdown,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error calculating portfolio summary:', error);
      return {
        totalValue: 0,
        total24hChange: 0,
        totalPositions: 0,
        chains: {},
        protocols: {},
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Convert Zerion positions to our EthereumPosition format
  convertToEthereumPositions(zerionPositions: ZerionPosition[]): any[] {
    return zerionPositions.map((position, index) => {
      const protocol = position.attributes.protocol || position.attributes.application;
      const value = position.attributes.value || 0;
      
      return {
        id: `zerion-${position.id}`,
        chain: this.getChainName(position.relationships?.chain?.data?.id),
        protocol: protocol?.name || 'Unknown',
        type: this.mapPositionType(position.type),
        tokenPair: position.attributes.name,
        tokenId: position.id,
        poolAddress: position.id,
        liquidity: position.attributes.fungible_info?.quantity || '0',
        tickLower: undefined,
        tickUpper: undefined,
        currentTick: undefined,
        priceLower: 0,
        priceUpper: 0,
        currentPrice: position.attributes.price || 0,
        token0: '',
        token1: '',
        fee: 0,
        inRange: true, // Assume in range for active positions
        tvlUsd: value,
        confirmed: true,
        lastUpdated: new Date()
      };
    });
  }

  private getChainName(chainId?: string): string {
    const chainMap: { [key: string]: string } = {
      'ethereum': 'Ethereum',
      'arbitrum': 'Arbitrum',
      'base': 'Base',
      'optimism': 'Optimism',
      'polygon': 'Polygon',
      'bsc': 'BSC',
      'avalanche': 'Avalanche'
    };
    
    return chainMap[chainId || ''] || 'Unknown';
  }

  private mapPositionType(zerionType: string): string {
    const typeMap: { [key: string]: string } = {
      'wallet': 'Wallet',
      'deposit': 'Deposit',
      'loan': 'Loan',
      'liquidity': 'Liquidity',
      'staked': 'Staked',
      'locked': 'Locked'
    };
    
    return typeMap[zerionType] || zerionType;
  }
}

export const zerionAPI = new ZerionAPI();
export default ZerionAPI;
export type { ZerionPosition, ZerionPortfolioResponse };