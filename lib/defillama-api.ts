import axios from 'axios';

const BASE_URL = 'https://api.llama.fi';

export interface ChainTvl {
  date: number;
  totalLiquidityUSD: number;
}

export interface Protocol {
  id: string;
  name: string;
  address: string;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  logo: string;
  audits: string;
  audit_note: string;
  gecko_id: string;
  cmcId: string;
  category: string;
  chains: string[];
  module: string;
  twitter: string;
  forkedFrom: string[];
  oracles: string[];
  listedAt: number;
  methodology: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  tokenBreakdowns: Record<string, any>;
  mcap: number;
}

export interface DexVolume {
  totalVolume: number;
  changeVolume1d: number;
  changeVolume7d: number;
  changeVolume30d: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  name: string;
  displayName: string;
  disabled: boolean;
  module: string;
  category: string;
  logo: string;
  chains: string[];
}

export interface PoolData {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  rewardTokens: string[];
  underlyingTokens: string[];
  poolMeta: string;
  url: string;
  apyPct1D: number;
  apyPct7D: number;
  apyPct30D: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictions: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
  volumeUsd1d: number;
  volumeUsd7d: number;
}

export interface StablePool {
  id: string;
  symbol: string;
  chain: string;
  address: string;
  tvl: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  volumeUsd1d: number;
  volumeUsd7d: number;
}

class DefiLlamaAPI {
  private axiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  // Get all protocols with TVL
  async getProtocols(): Promise<Protocol[]> {
    const { data } = await this.axiosInstance.get('/protocols');
    return data;
  }

  // Get TVL for specific protocol
  async getProtocolTVL(protocol: string): Promise<number> {
    const { data } = await this.axiosInstance.get(`/tvl/${protocol}`);
    return data;
  }

  // Get historical TVL for a specific chain
  async getChainTVL(chain: string): Promise<ChainTvl[]> {
    const { data } = await this.axiosInstance.get(`/v2/historicalChainTvl/${chain}`);
    return data;
  }

  // Get current TVL across all chains
  async getAllChainsTVL(): Promise<any[]> {
    const { data } = await this.axiosInstance.get('/v2/chains');
    return data;
  }

  // Get DEX volumes overview
  async getDexVolumes(): Promise<any> {
    const { data } = await this.axiosInstance.get('/overview/dexs');
    return data;
  }

  // Get DEX volume for specific chain
  async getDexVolumeByChain(chain: string): Promise<any> {
    const { data } = await this.axiosInstance.get(`/overview/dexs/${chain}`);
    return data;
  }

  // Get pools data (limited data from free API)
  async getPools(): Promise<PoolData[]> {
    const { data } = await this.axiosInstance.get('/pools');
    return data.data;
  }

  // Get stablecoin pools
  async getStablecoinPools(): Promise<any> {
    const { data } = await this.axiosInstance.get('/stablecoins/pools');
    return data;
  }

  // Get fees and revenue overview
  async getFees(): Promise<any> {
    const { data } = await this.axiosInstance.get('/overview/fees');
    return data;
  }

  // Get fees for specific chain
  async getFeesByChain(chain: string): Promise<any> {
    const { data } = await this.axiosInstance.get(`/overview/fees/${chain}`);
    return data;
  }

  // Get specific protocol details
  async getProtocolDetails(protocol: string): Promise<any> {
    const { data } = await this.axiosInstance.get(`/protocol/${protocol}`);
    return data;
  }

  // Filter protocols by chain
  async getProtocolsByChain(chain: string): Promise<Protocol[]> {
    const protocols = await this.getProtocols();
    return protocols.filter(p => 
      p.chains && p.chains.includes(chain) && p.chainTvls[chain] > 0
    );
  }

  // Get top protocols by TVL for specific chains
  async getTopProtocolsByChains(
    chains: string[], 
    limit: number = 10
  ): Promise<Record<string, Protocol[]>> {
    const allProtocols = await this.getProtocols();
    const result: Record<string, Protocol[]> = {};

    for (const chain of chains) {
      const chainProtocols = allProtocols
        .filter(p => p.chains && p.chains.includes(chain) && p.chainTvls[chain] > 0)
        .sort((a, b) => (b.chainTvls[chain] || 0) - (a.chainTvls[chain] || 0))
        .slice(0, limit);
      
      result[chain] = chainProtocols;
    }

    return result;
  }

  // Get aggregated metrics for target chains
  async getChainMetrics(chains: string[]): Promise<any> {
    const [allChainsTvl, dexVolumes] = await Promise.all([
      this.getAllChainsTVL(),
      this.getDexVolumes()
    ]);

    const targetChainsTvl = allChainsTvl.filter(chain => 
      chains.includes(chain.name.toLowerCase())
    );

    const targetDexVolumes = dexVolumes.chains?.filter((chain: any) => 
      chains.includes(chain.name.toLowerCase())
    );

    return {
      tvl: targetChainsTvl,
      dexVolumes: targetDexVolumes
    };
  }
}

export const defiLlamaAPI = new DefiLlamaAPI();

// Chain identifiers for your target chains
export const TARGET_CHAINS = {
  // Ethereum L1
  ETHEREUM: 'ethereum',
  
  // Ethereum L2s
  ARBITRUM: 'arbitrum',
  OPTIMISM: 'optimism',
  BASE: 'base',
  POLYGON: 'polygon',
  
  // Other chains
  SOLANA: 'solana',
  SUI: 'sui'
};

export const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  polygon: 'Polygon',
  solana: 'Solana',
  sui: 'Sui'
};