// Hedge detection utility for identifying perpetual markets available for pool tokens

interface HedgeAvailability {
  token: string;
  protocol: string;
  chain: string;
  pair: string;
  leverage?: string;
}

// Comprehensive perpetual markets database from our research
const PERPETUAL_MARKETS = {
  // GMX V2 (Arbitrum) - 70+ pairs
  gmx_v2: {
    protocol: 'GMX V2',
    chain: 'Arbitrum',
    pairs: [
      'BTC', 'ETH', 'SOL', 'LINK', 'ARB', 'AVAX', 'UNI', 'DOGE', 'PEPE', 
      'WLD', 'MKR', 'ALGO', 'SEI', 'HYPE', 'ANIME', 'XRP', 'LTC', 'BNB', 
      'ATOM', 'NEAR', 'AAVE', 'OP', 'GMX', 'WIF', 'kSHIB', 'ORDI', 'STX', 
      'TRUMP', 'MELANIA', 'AI16Z', 'PENGU', 'VIRTUAL', 'FARTCOIN', 'BERA'
    ],
    leverage: 'Up to 100x'
  },
  
  // Jupiter (Solana) - 3 pairs
  jupiter: {
    protocol: 'Jupiter',
    chain: 'Solana', 
    pairs: ['SOL', 'ETH', 'WBTC'],
    leverage: 'Up to 100x'
  },
  
  // Drift (Solana) - 75 pairs
  drift: {
    protocol: 'Drift',
    chain: 'Solana',
    pairs: [
      'BTC', 'SOL', 'ETH', 'APT', '1MBONK', 'POL', 'ARB', 'DOGE', 'BNB', 
      'SUI', '1MPEPE', 'OP', 'RENDER', 'XRP', 'HNT', 'WIF', 'W'
    ],
    leverage: 'Up to 101x'
  },
  
  // Hyperliquid (L1) - 176+ pairs  
  hyperliquid: {
    protocol: 'Hyperliquid',
    chain: 'Hyperliquid L1',
    pairs: [
      // Tier 1 Assets
      'BTC', 'ETH', 'SOL', 'AVAX', 'DOGE',
      // Popular Altcoins
      'ARB', 'JUP', 'WIF', 'ADA', 'BNB', 'AAVE', 'CRV', 'LINK', 'LTC', 
      'ONDO', 'BIGTIME', 'HBAR', 'PENDLE', 'TIA', 'POPCAT', 'TON', 'TAO', 
      'NEAR', 'OM', 'MKR', 'OP', 'FIL', 'XLM', 'ZRO', 'LDO',
      // Meme/Community Tokens
      'PEPE', 'MOG', 'NEIRO', 'TRUMP', 'GPT', 'PUMP', 'MEOW', 'APU', 
      'PANDA', 'PEAR',
      // Platform-Specific Assets
      'HYPE', 'PURR', 'WOULD', 'PIP', 'BUDDY', 'HFUN', 'RAGE', 'LATINA', 
      'BEATS', 'FARM'
    ],
    leverage: '3x-50x'
  }
};

// Common token symbol mappings to normalize variations
const TOKEN_SYMBOL_MAPPINGS = {
  // Bitcoin variations
  'WBTC': 'BTC',
  'BTCB': 'BTC', 
  'BTC.B': 'BTC',
  'WBTC.B': 'BTC',
  
  // Ethereum variations
  'WETH': 'ETH',
  'WETH9': 'ETH',
  'ETH9': 'ETH',
  
  // Solana variations
  'WSOL': 'SOL',
  
  // Stablecoins (typically not hedged)
  'USDC': 'STABLE',
  'USDT': 'STABLE', 
  'DAI': 'STABLE',
  'FRAX': 'STABLE',
  'USDC.E': 'STABLE',
  'USDT.E': 'STABLE',
  
  // Other common mappings
  'MATIC': 'POL', // Polygon rebrand
  'WMATIC': 'POL'
};

/**
 * Parse pool symbol to extract individual tokens
 * Examples: "ETH-USDC", "BTC/USDT", "SOL-USDC-V3", "WETH/WBTC"
 */
export function parsePoolSymbol(symbol: string): string[] {
  // Remove common suffixes
  const cleanSymbol = symbol
    .replace(/-V[0-9]+$/i, '') // Remove version suffixes like -V3
    .replace(/-LP$/i, '') // Remove LP suffix
    .replace(/-[0-9]+BP$/i, '') // Remove basis points like -500BP
    .replace(/\s+/g, ''); // Remove spaces
  
  // Split on common delimiters
  const tokens = cleanSymbol.split(/[-\/\_\s]+/);
  
  // Filter out common non-token parts and normalize
  return tokens
    .filter(token => token.length > 0)
    .filter(token => !['LP', 'V1', 'V2', 'V3', 'POOL'].includes(token.toUpperCase()))
    .map(token => token.toUpperCase())
    .map(token => TOKEN_SYMBOL_MAPPINGS[token] || token)
    .filter(token => token !== 'STABLE'); // Remove stablecoins as they don't need hedging
}

/**
 * Find available hedges for a given token across all perpetual platforms
 */
export function findTokenHedges(token: string): HedgeAvailability[] {
  const normalizedToken = TOKEN_SYMBOL_MAPPINGS[token.toUpperCase()] || token.toUpperCase();
  const hedges: HedgeAvailability[] = [];
  
  // Skip stablecoins
  if (normalizedToken === 'STABLE') return hedges;
  
  // Check each protocol
  Object.entries(PERPETUAL_MARKETS).forEach(([key, market]) => {
    if (market.pairs.includes(normalizedToken)) {
      hedges.push({
        token: normalizedToken,
        protocol: market.protocol,
        chain: market.chain,
        pair: `${normalizedToken}/USD`,
        leverage: market.leverage
      });
    }
  });
  
  return hedges;
}

/**
 * Analyze a pool for hedge availability
 */
export function analyzePoolHedges(poolSymbol: string) {
  const tokens = parsePoolSymbol(poolSymbol);
  const hedgeAnalysis = {
    tokens: tokens,
    volatileTokens: [] as string[],
    hedgeableTokens: [] as string[],
    availableHedges: [] as HedgeAvailability[],
    deltaNeutralPossible: false,
    hedgeCoverage: 0 // Percentage of volatile tokens that can be hedged
  };
  
  // Separate volatile tokens (non-stablecoins) from all tokens
  tokens.forEach(token => {
    const normalizedToken = TOKEN_SYMBOL_MAPPINGS[token.toUpperCase()] || token.toUpperCase();
    if (normalizedToken !== 'STABLE') {
      hedgeAnalysis.volatileTokens.push(normalizedToken);
    }
  });
  
  // Find hedges for each volatile token
  hedgeAnalysis.volatileTokens.forEach(token => {
    const hedges = findTokenHedges(token);
    if (hedges.length > 0) {
      hedgeAnalysis.hedgeableTokens.push(token);
      hedgeAnalysis.availableHedges.push(...hedges);
    }
  });
  
  // Calculate hedge coverage based on volatile tokens only
  if (hedgeAnalysis.volatileTokens.length > 0) {
    hedgeAnalysis.hedgeCoverage = (hedgeAnalysis.hedgeableTokens.length / hedgeAnalysis.volatileTokens.length) * 100;
    
    // Delta neutral is possible if we can hedge ALL volatile tokens (stablecoins don't need hedging)
    hedgeAnalysis.deltaNeutralPossible = hedgeAnalysis.hedgeableTokens.length === hedgeAnalysis.volatileTokens.length;
  }
  
  return hedgeAnalysis;
}

/**
 * Get the best hedge option for a token (prioritizing by liquidity/volume)
 */
export function getBestHedgeOption(token: string): HedgeAvailability | null {
  const hedges = findTokenHedges(token);
  if (hedges.length === 0) return null;
  
  // Priority order: Hyperliquid (highest volume), GMX V2, Drift, Jupiter
  const priorityOrder = ['Hyperliquid', 'GMX V2', 'Drift', 'Jupiter'];
  
  for (const protocol of priorityOrder) {
    const hedge = hedges.find(h => h.protocol === protocol);
    if (hedge) return hedge;
  }
  
  return hedges[0]; // Fallback to first available
}

/**
 * Generate a hedge summary for display
 */
export function generateHedgeSummary(poolSymbol: string): {
  hasHedges: boolean;
  hedgeCount: number;
  bestProtocol?: string;
  coverage: number;
  deltaNetural: boolean;
} {
  const analysis = analyzePoolHedges(poolSymbol);
  const bestHedge = analysis.volatileTokens.length > 0 ? 
    getBestHedgeOption(analysis.volatileTokens[0]) : null;
  
  return {
    hasHedges: analysis.availableHedges.length > 0,
    hedgeCount: analysis.availableHedges.length,
    bestProtocol: bestHedge?.protocol,
    coverage: analysis.hedgeCoverage,
    deltaNetural: analysis.deltaNeutralPossible
  };
}