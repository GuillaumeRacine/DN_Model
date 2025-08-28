# API Endpoints & Data Source Documentation

This comprehensive guide documents all API endpoints, data sources, and integration methods used across the DN_Model dashboard. Use this reference to replicate exact data connections and obtain identical data results.

---

## =� Overview

The DN_Model dashboard integrates data from **6 primary chains** and **15+ protocols** through a combination of:
- **Direct API calls** for real-time market data
- **RPC endpoints** for blockchain-specific position data  
- **Protocol SDKs** for accurate position calculations
- **Fallback systems** for reliability and uptime

---

## < Multi-Chain Data Sources

### **1. SOLANA Ecosystem**

#### **= Primary RPC Provider**
- **Service**: Helius RPC (Premium)
- **Endpoint**: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
- **Environment Variable**: `HELIUS_RPC_URL`
- **Purpose**: Solana blockchain data, NFT metadata, account information
- **Rate Limits**: 1000 req/sec (Premium plan)
- **Data Provided**:
  - Solana account data for position discovery
  - NFT metadata for Raydium CLMM positions
  - Token account balances
  - Transaction history

#### **<
 Orca Whirlpools**
- **Protocol**: Orca (Concentrated Liquidity)
- **SDK**: `@orca-so/whirlpools-sdk` + `@orca-so/common-sdk`
- **Data Source**: Direct RPC calls via Helius
- **Position Discovery**: Wallet scanning for Whirlpool positions
- **Implementation**: `lib/solana-position-tracker.ts`
- **Data Provided**:
  - Active liquidity positions
  - Tick ranges and current prices
  - Pool information and fee tiers
  - Position token amounts (amount0, amount1)

#### **� Raydium CLMM**
- **Protocol**: Raydium (Concentrated Liquidity Market Maker)
- **SDK**: `@raydium-io/raydium-sdk-v2`
- **Data Source**: NFT-based position discovery via Helius DAS API
- **Position Discovery**: NFT collection scanning for CLMM positions
- **Implementation**: `scripts/ethereum-position-scanner.js` (adapted)
- **Data Provided**:
  - CLMM position NFTs
  - Position ranges and liquidity amounts
  - Pool state and pricing data
  - Fee collection information

---

### **2. SUI Ecosystem**

#### **= Primary RPC Provider**
- **Service**: SUI Foundation RPC
- **Endpoint**: `https://fullnode.mainnet.sui.io:443`
- **Authentication**: None required (public endpoint)
- **Purpose**: SUI blockchain data and object queries
- **Implementation**: `lib/cetus-position-integrator.js`

#### **= CETUS Protocol**
- **Protocol**: CETUS (Concentrated Liquidity)
- **SDK**: `@cetusprotocol/cetus-sui-clmm-sdk`
- **Data Source**: Direct SUI RPC + CETUS SDK
- **Position Discovery**: Wallet object scanning
- **Mathematical Precision**: USDC(6)/SUI(8) decimals (NOT SUI(9))
- **Implementation**: `lib/cetus-accurate-converter.js`
- **Verification Script**: `scripts/final-cetus-verification.js`
- **Data Provided**:
  - Concentrated liquidity positions with perfect accuracy
  - Tick-to-price conversion using TickMath.tickIndexToPrice()
  - Position ranges: tick_lower_index � tick_upper_index
  - Liquidity amounts and current status
- **Reference**: `docs/CETUS_INTEGRATION.md` for implementation details

---

### **3. Ethereum L1 & L2 Ecosystems**

#### **= Primary Data Provider**
- **Service**: Zerion API (Premium Portfolio Tracker)
- **Endpoint**: `https://api.zerion.io/v1`
- **Authentication**: Basic Auth with API key as username
- **Environment Variable**: `ZERION_API_KEY`
- **Implementation**: `lib/zerion-api.ts`
- **Rate Limits**: 1000 req/hour (Premium plan)

#### **<
 Ethereum Mainnet Positions**
- **Wallet Address**: `0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af`
- **Protocols Tracked**:
  - Uniswap V3 (native positions)
  - Other ERC-721 based LP positions
- **API Endpoint**: `/wallets/{address}/positions/`
- **Query Parameters**: `?filter[positions]=no_filter&sort=value&page[size]=100`

#### **=5 Base Chain (Aerodrome)**
- **Protocol**: Aerodrome Finance
- **Base**: Uniswap V3 compatible
- **SDK Integration**: `ethers` + custom position fetcher
- **Implementation**: `lib/aerodrome-position-fetcher.ts`
- **Data Source**: Direct Base RPC calls
- **Position Discovery**: Factory contract scanning

#### **=4 Arbitrum Positions**
- **Data Source**: Zerion API (multi-chain portfolio tracking)
- **Coverage**: All major Arbitrum DEX protocols
- **Position Types**: Uniswap V3, Camelot, others via Zerion

---

## =� Market Data & Pool Information

### **=� Primary Market Data Provider**

#### **>� DeFiLlama (Pro API)**
- **Service**: DeFiLlama Pro
- **Endpoint**: `https://pro-api.llama.fi/${DEFILLAMA_API_KEY}`
- **Environment Variable**: `DEFILLAMA_API_KEY`
- **Implementation**: `lib/defillama-api.ts`
- **Caching**: 60-minute TTL via `lib/data-cache.ts`

**Data Endpoints:**
- **Token Prices**: `/coins/prices/current/${tokenIds}`
- **Yield Pools**: `/yields/pools` (100+ pools, TVL e $1M)
- **Historical Data**: `/coins/prices/historical/${timestamp}/${tokenIds}`
- **Charts**: `/coins/chart/${tokenIds}`

#### **= Fallback Price Provider**
- **Service**: CoinGecko Free API
- **Endpoint**: `https://api.coingecko.com/api/v3`
- **Purpose**: Automatic fallback when DeFiLlama Pro fails
- **Implementation**: Automatic failover in `lib/defillama-api.ts`
- **Rate Limits**: 10-30 calls/minute (free tier)

**Fallback Endpoints:**
- **Simple Prices**: `/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`
- **Market Data**: `/coins/markets?vs_currency=usd`

---

## <� Implementation Architecture

### **=� Application API Routes**

#### **Health Monitoring**: `/api/health`
- **Purpose**: Monitor all external API endpoints
- **Implementation**: `app/api/health/route.ts`
- **Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "summary": {
    "workingAPIs": ["DeFiLlama", "Helius RPC", "Zerion API", "CoinGecko"],
    "degradedAPIs": ["CoinStats"],
    "failingAPIs": ["Solscan"],
    "recommendations": ["Check CoinStats credentials", "Verify Solscan endpoint"]
  }
}
```

#### **Cache Status**: `/api/cache-status`
- **Purpose**: Monitor 60-minute data cache system
- **Implementation**: `app/api/cache-status/route.ts`
- **Cache Keys Tracked**:
  - `token_prices` - DeFiLlama/CoinGecko price data
  - `yield_pools` - High-yield pool data
  - `api_health` - Endpoint health status
  - `zerion_portfolio` - Portfolio position data

#### **Portfolio Tracking**: `/api/zerion-portfolio`
- **Purpose**: Fetch real-time portfolio positions
- **Implementation**: `app/api/zerion-portfolio/route.ts`
- **Data Source**: Zerion API with authentication

#### **Endpoint Testing**: `/api/test-endpoint`
- **Purpose**: Test connectivity to any endpoint
- **Implementation**: `app/api/test-endpoint/route.ts`
- **Method**: HEAD requests with 5-second timeout

---

## =' Configuration & Environment Setup

### **Required Environment Variables**

```bash
# Primary API Keys (Required)
DEFILLAMA_API_KEY=your_defillama_pro_key
ZERION_API_KEY=your_zerion_api_key
HELIUS_API_KEY=your_helius_key

# RPC Endpoints
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}

# Public Variables (Client-side access)
NEXT_PUBLIC_DEFILLAMA_API_KEY=your_defillama_pro_key

# Wallet Addresses & Position IDs
# Solana Wallet
SOLANA_WALLET=DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k

# Orca Positions
ORCA_POSITION_1=FE1VVxiLxdUnBw1MA7ScHXaF98i2q9oiXnhnwK6x3ZsB
ORCA_POSITION_2=DH2Wr385mowQ8wEi6wqWPrK4T9HxeKPbMUcumnLu9VnA
ORCA_POSITION_3=EmnwXx7swzFzABcZ2UnknPRNrFiH8shBnM5bFg6zEiZZ

# Raydium Positions
RAYDIUM_POSITION_1=4ecJbuCtn799DBYecYPfwtoKWLYjmnGaFsDhtp9nya66
RAYDIUM_POSITION_2=7CyEg9qhNKoP5HJjksXrYoCQ5gT64FLgjogXk7vZxZqQ

# Ethereum Wallet
ETHEREUM_WALLET=0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af

# SUI Wallet
SUI_WALLET=0x811c7733b0e283051b3639c529eeb17784f9b19d275a7c368a3979f509ea519a

# CETUS Positions
CETUS_POSITION_1=0x6c08a2dd40043e58085155c68d78bf3f62f19252feb6effa41b0274b284dbfa0
CETUS_POSITION_2=0x8e58a0cc8ebd5443a23bcf11955855636f5e0e9e88c5a216b838db0c23383281
```

---

## >� Testing & Verification

### **API Endpoint Testing Script**
- **File**: `scripts/test-api-endpoints.js`
- **Purpose**: Validate all API connections and data quality
- **Usage**: `node scripts/test-api-endpoints.js`

### **Position Verification Scripts**
- **CETUS**: `scripts/final-cetus-verification.js`
- **Ethereum**: `scripts/advanced-eth-scanner.js`
- **General**: `scripts/test-cetus-integrator.js`

### **Data Quality Validation**
- **Real-time monitoring** via `/api/health` endpoint
- **Fallback testing** automatic in `lib/defillama-api.ts`
- **Cache validation** via `lib/data-cache.ts` cleanup system

---

## =� Data Flow & Processing

### **Position Data Pipeline**
1. **Discovery**: Wallet scanning across all chains
2. **Extraction**: Protocol-specific data retrieval
3. **Conversion**: Tick-to-price using protocol math
4. **Normalization**: USD value standardization
5. **Validation**: Cross-reference with `math.md` formulas
6. **Caching**: 60-minute intelligent cache storage
7. **Display**: Real-time UI updates with refresh status

### **Market Data Pipeline**
1. **Primary Fetch**: DeFiLlama Pro API call
2. **Fallback**: CoinGecko API if primary fails
3. **Caching**: Store with 60-minute TTL
4. **Filtering**: Pool filtering (TVL e $1M)
5. **Enhancement**: Delta neutral hedge detection
6. **Display**: Sortable tables with real-time updates

---

## = Fallback & Reliability Systems

### **API Fallback Hierarchy**
1. **DeFiLlama Pro** � **CoinGecko** � **Cached Data**
2. **Helius RPC** � **Public Solana RPC** (if configured)
3. **Zerion API** � **Direct RPC calls** � **Cached Positions**

### **Error Handling Strategy**
- **Graceful degradation** for non-critical failures
- **Cache-first** approach for performance
- **Real-time status** monitoring and user notification
- **Automatic retry** logic with exponential backoff

---

## =� Performance Optimizations

### **Caching Strategy**
- **60-minute TTL** for all market data
- **Position data** cached until manual refresh
- **API health** cached for 5 minutes
- **Automatic cleanup** every 10 minutes

### **Rate Limit Management**
- **Request batching** for multiple token queries
- **Intelligent delays** between sequential calls
- **Priority queuing** for critical data updates
- **Fallback activation** before hitting limits

---

## =� Usage Instructions

### **To Replicate This Setup:**

1. **Obtain API Keys**:
   - DeFiLlama Pro: Subscribe at [DeFiLlama](https://defillama.com/pro-api)
   - Zerion API: Apply at [Zerion Developers](https://developers.zerion.io/)
   - Helius RPC: Sign up at [Helius](https://www.helius.dev/)

2. **Configure Environment**:
   - Copy `.env.example` to `.env`
   - Add all required API keys and wallet addresses
   - Ensure position IDs are correctly formatted

3. **Install Dependencies**:
   ```bash
   npm install
   # Key packages for multi-chain support
   npm install @cetusprotocol/cetus-sui-clmm-sdk @orca-so/whirlpools-sdk @raydium-io/raydium-sdk-v2 ethers
   ```

4. **Test Connections**:
   ```bash
   node scripts/test-api-endpoints.js
   npm run dev
   # Navigate to http://localhost:3002/endpoints for health check
   ```

5. **Verify Position Data**:
   - Check DN Model tab for real position display
   - Verify USD values match expected ranges
   - Confirm in-range/out-of-range status accuracy

---

## <� Critical Implementation Notes

### **Mathematical Accuracy**
- All calculations must reference `math.md` formulas
- Position values use piecewise functions from math.md Section 1
- FVR calculations follow math.md Section 3 methodology

### **Data Source Priority**
- **Real blockchain data** always takes precedence
- **API aggregators** (Zerion, DeFiLlama) for efficiency
- **Direct RPC calls** for protocol-specific accuracy
- **No mock or placeholder data** allowed

### **Cross-Chain Normalization**
- USD values standardized across all chains
- Position status unified (in-range, out-of-range, no-liquidity)  
- Time zones normalized to UTC
- Decimal precision handled per protocol specifications

---

**� Important**: This document must be kept up-to-date with any API changes, new protocol integrations, or endpoint modifications. Always test endpoint connectivity before deploying changes.

**=� Related Documentation**:
- `math.md` - Mathematical formulas and theory
- `docs/CETUS_INTEGRATION.md` - SUI CETUS implementation details
- `README.md` - User setup and installation guide
- `CLAUDE.md` - Technical development documentation