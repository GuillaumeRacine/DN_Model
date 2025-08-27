# Delta Neutral CLM Model - Data Requirements

## Overview
Comprehensive data structure and sources for implementing a delta neutral concentrated liquidity management (CLM) strategy with real-time tracking and backtesting capabilities.

---

## 1. Pool-Level Data (Real-Time & Historical)

### 1.1 Basic Pool Information
```typescript
interface PoolData {
  // Identity
  poolAddress: string
  protocol: string           // uniswap-v3, raydium-clmm, orca, cetus
  chain: string             // ethereum, arbitrum, solana, etc.
  token0: string            // e.g., "ETH"
  token1: string            // e.g., "USDC"
  feeTier: number          // 0.0001, 0.0005, 0.003, 0.01
  
  // Current State (real-time, every block/second)
  currentPrice: number      // P: token1 per token0
  currentTick: number       // for tick-based protocols
  sqrtPriceX96: bigint     // raw price format
  
  // Liquidity Distribution
  activeLiquidity: number   // L at current tick
  totalValueLocked: number  // TVL in USD
  liquidityDepth: {         // liquidity at different price levels
    tick: number
    liquidity: number
  }[]
}
```

**Data Sources:**
- **On-chain RPC**: Direct contract calls for real-time state
- **The Graph Protocol**: Indexed historical data for Uniswap V3
- **DeFiLlama Pro API**: TVL and cross-protocol aggregation
- **Dune Analytics**: Historical snapshots and aggregated metrics

### 1.2 Volume & Fee Metrics
```typescript
interface VolumeData {
  // Time series (hourly/daily granularity)
  timestamp: number
  volume24h: number         // in USD
  volume7d: number
  volume30d: number
  
  // Fee generation
  fees24h: number          // actual fees collected
  fees7d: number
  fees30d: number
  
  // Breakdown by tick range
  volumeByRange: {
    lowerTick: number
    upperTick: number
    volume: number
    fees: number
  }[]
}
```

**Data Sources:**
- **Flipside Crypto**: Granular swap-level data
- **Dune Analytics**: Aggregated volume/fee queries
- **Protocol-specific APIs**: GMX, Drift, etc.

### 1.3 Price History (OHLCV)
```typescript
interface PriceData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  
  // Derived metrics
  logReturn: number        // ln(close/prev_close)
  ticksCrossed: number     // number of tick boundaries crossed
  timeInRange: {           // for specific ranges
    lowerPrice: number
    upperPrice: number
    percentInRange: number
  }[]
}
```

**Data Sources:**
- **CoinGecko/CoinMarketCap**: CEX price data for comparison
- **Chainlink Price Feeds**: Oracle prices
- **Protocol Events**: Swap events from blockchain

---

## 2. Position-Level Data

### 2.1 LP Position Tracking
```typescript
interface LPPosition {
  // Position identity
  positionId: string       // NFT token ID or position hash
  owner: string
  poolAddress: string
  
  // Range definition
  lowerPrice: number       // Pa
  upperPrice: number       // Pb
  lowerTick: number
  upperTick: number
  
  // Liquidity parameters
  liquidity: bigint        // L parameter
  depositedAmount0: number // initial token0
  depositedAmount1: number // initial token1
  
  // Current state
  currentAmount0: number   // current token0 balance
  currentAmount1: number   // current token1 balance
  unclaimedFees0: number
  unclaimedFees1: number
  
  // Position value tracking
  currentValueUSD: number
  initialValueUSD: number
  
  // Greeks
  delta: number           // token0 exposure
  gamma: number          // -L/(2*s^3)
}
```

**Data Sources:**
- **NFT Position Manager Contracts**: Direct position queries
- **Subgraphs**: Historical position events
- **Position simulators**: For hypothetical positions

### 2.2 Simulated Position Metrics
```typescript
interface SimulatedPosition {
  // Backtest parameters
  startDate: Date
  endDate: Date
  initialCapital: number
  
  // Range strategy
  rangeStrategy: 'fixed' | 'dynamic' | 'bollinger' | 'percentile'
  rangeWidth: number       // e.g., ±10% from current price
  rebalanceFrequency: 'never' | 'daily' | 'weekly' | 'threshold'
  
  // Performance metrics
  totalFees: number
  impermanentLoss: number
  netPnL: number
  sharpeRatio: number
  maxDrawdown: number
  
  // Time series data
  dailySnapshots: {
    date: Date
    value: number
    fees: number
    il: number
    delta: number
  }[]
}
```

---

## 3. Perpetual Market Data

### 3.1 Perpetual Contract State
```typescript
interface PerpetualData {
  // Market identity
  market: string           // e.g., "ETH-PERP"
  protocol: string        // gmx, drift, hyperliquid, jupiter
  
  // Pricing
  markPrice: number
  indexPrice: number
  basis: number           // mark - index
  
  // Funding
  fundingRate: number     // current rate (8h or 1h)
  fundingRateAnnualized: number
  nextFundingTime: number
  historicalFunding: {
    timestamp: number
    rate: number
  }[]
  
  // Market depth
  openInterest: number
  maxLeverage: number
  minOrderSize: number
  
  // Costs
  takerFee: number
  makerFee: number
  
  // Liquidation
  maintenanceMargin: number
  initialMargin: number
}
```

**Data Sources:**
- **GMX V2 API**: Real-time Arbitrum perps
- **Drift Protocol API**: Solana perps data
- **Hyperliquid API**: L1 perps with deep liquidity
- **Jupiter Perps API**: Limited but important SOL markets
- **Coinglass**: Aggregated funding rates

### 3.2 Hedge Position Tracking
```typescript
interface HedgePosition {
  // Position details
  perpMarket: string
  protocol: string
  size: number            // negative for short
  entryPrice: number
  markPrice: number
  
  // Costs
  totalFundingPaid: number
  totalTradingFees: number
  unrealizedPnL: number
  
  // Risk metrics
  liquidationPrice: number
  marginRatio: number
  
  // Rebalance history
  rebalances: {
    timestamp: number
    previousSize: number
    newSize: number
    cost: number
  }[]
}
```

---

## 4. Volatility & Risk Metrics

### 4.1 Volatility Data
```typescript
interface VolatilityData {
  // Realized volatility
  realized1d: number
  realized7d: number
  realized30d: number
  
  // Different calculation methods
  closeToClose: number    // traditional
  parkinson: number       // using high/low
  garmanKlass: number     // OHLC estimator
  yangZhang: number       // drift-independent
  
  // Term structure
  termStructure: {
    period: string        // "1d", "7d", "30d", "90d"
    volatility: number
  }[]
  
  // Implied volatility (if available)
  iv30: number           // from options markets
  ivRank: number         // percentile vs history
}
```

**Data Sources:**
- **Amberdata**: Comprehensive volatility metrics
- **Tardis/Kaiko**: Tick-level data for precise calculations
- **Deribit/Lyra**: Options-implied volatility
- **Custom calculations**: From raw price data

### 4.2 Correlation Data
```typescript
interface CorrelationData {
  // Cross-asset correlations
  correlationMatrix: {
    asset1: string
    asset2: string
    correlation30d: number
  }[]
  
  // Beta to market
  betaToETH: number
  betaToBTC: number
  
  // Regime detection
  volatilityRegime: 'low' | 'normal' | 'high'
  trendRegime: 'bullish' | 'neutral' | 'bearish'
}
```

---

## 5. Backtesting Requirements

### 5.1 Historical Data Granularity
```typescript
interface BacktestDataRequirements {
  // Minimum data requirements
  priceData: {
    frequency: '1min' | '5min' | '1hour'
    period: '30days' | '90days' | '1year'
  }
  
  volumeData: {
    frequency: '1hour' | '1day'
    period: '90days' | '1year'
  }
  
  fundingData: {
    frequency: '1hour' | '8hour'
    period: '90days'
  }
  
  liquidityData: {
    frequency: '1hour' | '1day'
    snapshots: boolean    // full liquidity distribution
  }
}
```

### 5.2 Simulation Parameters
```typescript
interface SimulationConfig {
  // Position parameters
  capitalAllocation: number
  leverageRatio: number
  
  // Range management
  rangeStrategy: {
    type: 'fixed' | 'dynamic'
    parameters: {
      width?: number      // for fixed
      bollingerPeriod?: number  // for dynamic
      bollingerStdDev?: number
    }
  }
  
  // Rebalancing rules
  rebalancing: {
    trigger: 'time' | 'price' | 'delta'
    threshold: number
    maxRebalancesPerDay: number
    minTimeBetweenRebalances: number
  }
  
  // Cost assumptions
  costs: {
    lpGasFeesUSD: number
    perpGasFeesUSD: number
    slippageBps: number
    additionalSpreadBps: number
  }
}
```

---

## 6. Ranking & Scoring System

### 6.1 Pool Attractiveness Score
```typescript
interface PoolScore {
  poolAddress: string
  
  // Component scores (0-100)
  feeScore: number         // based on FeeAPR
  volumeScore: number      // consistency and magnitude
  volatilityScore: number  // fee-to-vol ratio
  liquidityScore: number   // depth and stability
  hedgeScore: number       // availability and cost of hedge
  
  // Weighted composite
  totalScore: number       // weighted average
  rank: number            // relative ranking
  
  // Risk-adjusted metrics
  sharpeRatio: number     // (return - riskFree) / volatility
  sortinoRatio: number    // downside deviation only
  calmarRatio: number     // return / maxDrawdown
  
  // Expected returns
  expectedGrossAPR: number
  expectedIL: number
  expectedNetAPR: number
  confidenceInterval: [number, number]  // 95% CI
}
```

### 6.2 ML Features for Ranking
```typescript
interface MLFeatures {
  // Technical indicators
  priceMACD: number
  volumeRSI: number
  liquidityTrend: number
  
  // Market microstructure
  bidAskSpread: number
  orderBookImbalance: number
  toxicFlow: number       // % of informed trading
  
  // Cross-market signals
  cexDexSpread: number
  fundingBasisCorrelation: number
  
  // Time-based features
  hourOfDay: number
  dayOfWeek: number
  monthlySeasonality: number
}
```

---

## 7. Real-Time Monitoring

### 7.1 Alert Conditions
```typescript
interface AlertConfig {
  // Position alerts
  priceOutOfRange: boolean
  deltaThreshold: number
  ilThreshold: number
  
  // Market alerts
  fundingSpike: number    // % threshold
  volatilitySpike: number
  liquidityDrop: number
  
  // Performance alerts
  drawdownLimit: number
  dailyLossLimit: number
}
```

### 7.2 Dashboard Metrics
```typescript
interface DashboardData {
  // Portfolio overview
  totalValueUSD: number
  totalPnL: number
  activePositions: number
  
  // Real-time Greeks
  portfolioDelta: number
  portfolioGamma: number
  
  // Risk metrics
  currentDrawdown: number
  VaR95: number           // 95% Value at Risk
  stressTestResults: {
    scenario: string
    impact: number
  }[]
}
```

---

## 8. Data Pipeline Architecture

### 8.1 Data Collection Layer
```yaml
sources:
  blockchain:
    - Ethereum RPC (Alchemy/Infura)
    - Arbitrum RPC
    - Solana RPC (Helius/QuickNode)
    
  apis:
    - DeFiLlama Pro (pools, TVL)
    - Dune Analytics (volume, fees)
    - The Graph (Uniswap subgraph)
    - GMX V2 API (perps)
    - Drift API (perps)
    - Hyperliquid API (perps)
    - CoinGecko (prices)
    
  databases:
    - TimescaleDB (time-series)
    - Redis (real-time cache)
    - PostgreSQL (positions, configs)
```

### 8.2 Update Frequencies
```yaml
realtime:  # < 1 second
  - current prices
  - funding rates
  - position values
  
high_frequency:  # 1-60 seconds
  - pool TVL
  - active liquidity
  - perpetual OI
  
medium_frequency:  # 5-60 minutes
  - volume metrics
  - fee calculations
  - volatility updates
  
low_frequency:  # daily
  - historical backtests
  - correlation matrices
  - ML model retraining
```

---

## 9. Implementation Priority

### Phase 1: Core Data (Week 1)
1. Pool prices and TVL (DeFiLlama)
2. Basic volume/fees (DeFiLlama)
3. Perpetual funding rates (protocol APIs)
4. Simple volatility (price-based)

### Phase 2: Position Tracking (Week 2)
1. LP position simulation
2. Delta calculation
3. IL tracking
4. Basic hedge sizing

### Phase 3: Backtesting (Week 3)
1. Historical data ingestion
2. Position replay engine
3. Performance metrics
4. Pool ranking system

### Phase 4: Advanced Features (Week 4+)
1. ML-based predictions
2. Dynamic rebalancing
3. Multi-pool portfolios
4. Risk management system

---

## 10. Data Quality Requirements

### Validation Rules
- Price sanity checks (% change limits)
- Volume consistency (cross-source validation)
- Funding rate bounds (-100% to +100% annualized)
- Liquidity non-negative constraints
- Timestamp continuity checks

### Fallback Strategies
- Multiple data sources for critical metrics
- Interpolation for missing data points
- Circuit breakers for anomalous data
- Manual override capabilities

---

## Next Steps

1. **Confirm data source access**: API keys and rate limits
2. **Set up data pipeline**: Start with Phase 1 sources
3. **Build position simulator**: Core math implementation
4. **Create ranking algorithm**: Weight optimization
5. **Develop monitoring dashboard**: Real-time tracking

This structure provides a comprehensive foundation for building a production-grade delta neutral CLM strategy system with full backtesting and real-time monitoring capabilities.