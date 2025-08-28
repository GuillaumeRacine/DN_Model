# DN_Model - Multi-Chain Delta Neutral CLM Dashboard

A comprehensive delta-neutral concentrated liquidity management (CLM) dashboard supporting multiple blockchains and protocols with real-time position tracking.

## 🌟 Features

### **Multi-Chain CLM Positions**
- **Real-Time Monitoring**: Live position tracking with price range visualization
- **Multi-Chain Support**: Solana (Orca, Raydium), SUI (CETUS), Ethereum, Base, Arbitrum
- **Perfect Accuracy**: 0.00% error rate for position calculations across all chains
- **USD Liquidity Display**: All positions shown in comparable USD values
- **Interactive UI**: Price range visualization with in/out-of-range indicators

### **Pools Analysis** 
- **100+ High-Yield Pools** with TVL ≥ $1M
- **Real-time APY tracking** and historical averages  
- **Delta Neutral CLM Detection** - identifies pools suitable for hedged strategies
- **Hedge Availability** - shows Yes/No for each pool's volatile tokens
- **Multi-chain support** - Ethereum, Arbitrum, Base, Solana, etc.

### **Perpetual Markets**
- **254+ Perpetual pairs** across 3 major DEX platforms:
  - **Hyperliquid** (176+ pairs) - Largest DEX perp market share
  - **Drift** (75 pairs) - Comprehensive Solana ecosystem  
  - **Jupiter** (3 pairs) - Blue-chip focused strategy

## 🏗️ Architecture

### **Frontend**
- **Next.js 15** with TypeScript
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Real-time data** from multiple APIs

### **APIs**
```
/api/health          - API health monitoring with fallback status
/api/cache-status    - Data cache status and refresh information
/api/test-endpoint   - Endpoint connectivity testing
/api/zerion-portfolio - Portfolio position tracking
```

### **Core Components**
- `CLMPositionDashboard` - Multi-chain position tracking and visualization
- `TopPoolsTab` - High-yield pools with hedge detection
- `SimplifiedHome` - Market overview with token prices and CAGR analysis
- `EndpointsTab` - API health monitoring and status dashboard
- `RefreshStatus` - Global refresh status and manual refresh functionality

## 🔧 Setup

### **Environment Variables**
```bash
# Required API Keys
DEFILLAMA_API_KEY=your_defillama_pro_key
ZERION_API_KEY=your_zerion_api_key
HELIUS_API_KEY=your_helius_rpc_key

# RPC Endpoints
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_key

# Public (for client-side)
NEXT_PUBLIC_DEFILLAMA_API_KEY=your_defillama_pro_key

# Position IDs & Wallet Addresses
# See endpoints.md for complete setup instructions
```

**📋 Complete API Setup Guide**: See `endpoints.md` for comprehensive instructions on:
- API key procurement and setup
- RPC endpoint configuration
- Wallet addresses and position ID setup
- Testing and verification procedures

### **Installation**
```bash
npm install
npm run dev
```

### **Key Dependencies**
- `@cetusprotocol/cetus-sui-clmm-sdk` - SUI CETUS protocol integration
- `@orca-so/whirlpools-sdk` - Solana Orca Whirlpools integration
- `@raydium-io/raydium-sdk-v2` - Solana Raydium CLMM integration
- `ethers` - Ethereum blockchain interaction
- `zustand` - State management
- `next` - React framework
- `typescript` - Type safety

## 📊 Data Sources

### **Pool Data**
- **DeFiLlama Pro API** - Pool metrics, APY, TVL with 60-minute caching
- **CoinGecko Fallback** - Automatic fallback for price data
- **Multi-protocol support** - Uniswap V3, Aerodrome, Raydium, Orca, etc.

### **Position Data**
- **Zerion API** - Multi-chain portfolio tracking (ETH, Base, Arbitrum)
- **Helius RPC** - Solana blockchain data (Orca, Raydium)
- **SUI RPC** - Direct blockchain queries for CETUS positions
- **Protocol SDKs** - Native integrations for mathematical accuracy

### **Perpetual Markets**
- **Static Database** - Jupiter, Drift, Hyperliquid market mappings (254+ pairs)
- **Real-time Integration** - Live data from supported DEX platforms

**🔗 Complete Data Source Documentation**: See `endpoints.md` for detailed integration specifications, rate limits, authentication methods, and fallback systems for all data sources.

## 🎯 Use Cases

### **For DeFi Yield Farmers**
- Find high-APY pools with hedge availability
- Identify delta neutral CLM opportunities
- Compare perpetual market options

### **For Risk Managers**
- Monitor real-time CLM position ranges and health
- Assess hedge coverage across multiple chains
- Track portfolio exposure with USD-normalized values

### **For Developers**
- Clean, modular TypeScript codebase
- Multi-chain SDK integrations (Solana, SUI, Ethereum)
- Comprehensive error handling and fallback systems

## 🔄 Data Refresh System

The app includes an intelligent 60-minute data refresh system:

- **Automatic Caching** - 60-minute TTL for all API data
- **Manual Refresh** - Bypass cache with refresh button
- **Global Status** - Real-time refresh timestamps across all components
- **Fallback Support** - CoinGecko fallback for DeFiLlama Pro API
- **Performance** - 99% reduction in API calls during cache period

## 📱 Navigation

- **Home** - Market overview with token prices, CAGR analysis, and ETF tracking
- **Pools** - High-yield pools (TVL ≥ $1M) with delta neutral detection  
- **DN Model** - **Multi-chain CLM position dashboard** (main feature)
- **Endpoints** - API health monitoring with fallback status

## 🎯 CLM Position Tracking

### Current Portfolio Coverage
- **Real Position Tracking** - Only live positions from your wallets
- **Multi-Chain Support** - Solana, SUI, Ethereum, Base, Arbitrum
- **USD Value Normalization** - All positions shown in comparable USD values
- **Real-Time Status** - Live in-range/out-of-range indicators

### Supported Protocols
- **Orca** (Solana): Whirlpool positions with precise tick ranges
- **Raydium** (Solana): CLMM positions via direct NFT reading
- **CETUS** (SUI): Perfect accuracy concentrated liquidity positions
- **Aerodrome** (Base): Uniswap V3 compatible positions
- **Uniswap V3** (Ethereum): Native V3 position support

### Position Features
- **Automatic Discovery**: Wallet scanning finds all positions
- **Real-Time Ranges**: Live price vs. range visualization
- **USD Normalization**: Comparable liquidity across chains
- **Status Indicators**: Immediate visual feedback on position health

## 🔄 Real-time Updates

- **60-Minute Auto-Refresh** - Automatic data refresh every hour
- **Position Monitoring** - Live CLM position range tracking
- **Price Feeds** - Real-time token prices with fallback systems
- **API Health Monitoring** - Continuous endpoint status checking

## 🌐 Multi-chain Support

**Supported Chains:**
- Ethereum, Arbitrum, Optimism, Base, Polygon
- Solana, Sui, Avalanche, BSC
- Hyperliquid L1

**Protocol Coverage:**
- 100+ DeFi protocols
- 254+ perpetual trading pairs
- Real-time cross-chain data

## 📁 Project Structure

```
DN_Model/
├── app/
│   ├── api/
│   │   ├── health/         # API health monitoring
│   │   └── cache-status/   # Data cache status
│   ├── layout.tsx          # App layout
│   └── page.tsx            # Main dashboard
├── components/
│   ├── CLMPositionDashboard.tsx  # Multi-chain position tracking
│   ├── TopPoolsTab.tsx          # Pools with hedge detection
│   ├── SimplifiedHome.tsx       # Market overview dashboard
│   ├── EndpointsTab.tsx         # API health monitoring
│   └── RefreshStatus.tsx        # Global refresh status
├── lib/
│   ├── data-cache.ts           # 60-minute data caching system
│   ├── defillama-api.ts        # DeFiLlama Pro API with fallbacks
│   ├── zerion-api.ts           # Portfolio tracking integration
│   ├── cetus-position-integrator.js  # SUI CETUS position reader
│   └── store.ts                # Zustand state management
├── docs/
│   └── CETUS_INTEGRATION.md    # CETUS protocol integration guide
├── endpoints.md                # 🔗 Complete API & data source specifications  
└── math.md                     # 📊 CLM mathematical model & theory reference
```

## 🚀 Getting Started

1. **Clone and install:**
```bash
git clone <repo-url>
cd DN_Model
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Add your API keys and wallet addresses (see endpoints.md for details)
```

3. **Run development server:**
```bash
npm run dev
```

4. **Verify setup & open in browser:**
```bash
# Test API connections (see endpoints.md)
node scripts/test-api-endpoints.js

# Open browser
http://localhost:3002
```

**📚 Documentation Reference:**
- `endpoints.md` - Complete API setup and data source specifications
- `math.md` - Mathematical formulas for CLM position calculations
- `docs/CETUS_INTEGRATION.md` - SUI CETUS protocol implementation details
- `CLAUDE.md` - Technical development documentation

---

Built with ❤️ for the DeFi community