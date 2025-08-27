# DN_Model - Multi-Chain Delta Neutral CLM Dashboard

A comprehensive delta-neutral concentrated liquidity management (CLM) dashboard supporting multiple blockchains and protocols with real-time position tracking.

## 🌟 Features

### **Multi-Chain CLM Positions**
- **Real-Time Monitoring**: Live position tracking with price range visualization
- **Multi-Chain Support**: Solana (Orca, Raydium) and SUI (CETUS) integration
- **Perfect Accuracy**: 0.00% error rate for CETUS position calculations
- **USD Liquidity Display**: All positions shown in comparable USD values
- **Interactive UI**: Price range sliders with in/out-of-range indicators

### **Pools Analysis** 
- **100+ High-Yield Pools** with TVL ≥ $1M
- **Real-time APY tracking** and historical averages  
- **Delta Neutral CLM Detection** - identifies pools suitable for hedged strategies
- **Hedge Availability** - shows Yes/No for each pool's volatile tokens
- **Multi-chain support** - Ethereum, Arbitrum, Base, Solana, etc.

### **Perpetual Markets**
- **324+ Perpetual pairs** across 4 major DEX platforms:
  - **Hyperliquid** (176+ pairs) - Largest DEX perp market share
  - **Drift** (75 pairs) - Comprehensive Solana ecosystem  
  - **GMX V2** (70+ pairs) - Deep Arbitrum liquidity
  - **Jupiter** (3 pairs) - Blue-chip focused strategy

## 🏗️ Architecture

### **Frontend**
- **Next.js 15** with TypeScript
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Real-time data** from multiple APIs

### **APIs**
```
/api/gmx-dune     - Dune Analytics SDK (comprehensive market data)
/api/gmx-proxy    - GMX Integration API (real-time prices)
```

### **Core Components**
- `TopPoolsTab` - Main pools interface with hedge detection
- `PerpetualTab` - Perpetual markets with data validation
- `SimplifiedHome` - Dashboard overview
- `hedge-detector` - Delta neutral analysis engine

## 🔧 Setup

### **Environment Variables**
```bash
# Required
DEFILLAMA_API_KEY=your_defillama_pro_key
DUNE_API_KEY=your_dune_api_key

# Public (for client-side)
NEXT_PUBLIC_DEFILLAMA_API_KEY=your_defillama_pro_key
```

### **Installation**
```bash
npm install
npm run dev
```

### **Dependencies**
- `@duneanalytics/client-sdk` - Dune data integration
- `zustand` - State management
- `next` - React framework
- `typescript` - Type safety

## 📊 Data Sources

### **Pool Data**
- **DeFiLlama Pro API** - Pool metrics, APY, TVL
- **Real-time updates** - Fresh data every request
- **Multi-protocol** - Uniswap, Aerodrome, Raydium, etc.

### **Perpetual Markets**
- **Dune Analytics** - Comprehensive GMX V2 market list (77 Arbitrum markets)
- **GMX Integration API** - Real-time prices and OI (4 major pairs)
- **Static Database** - Jupiter, Drift, Hyperliquid market mappings

## 🎯 Use Cases

### **For DeFi Yield Farmers**
- Find high-APY pools with hedge availability
- Identify delta neutral CLM opportunities
- Compare perpetual market options

### **For Risk Managers**
- Assess hedge coverage across pools
- Validate data quality before trading
- Monitor real vs estimated data sources

### **For Developers**
- Clean, modular codebase architecture
- Comprehensive API documentation
- Real-time data validation system

## 🛡️ Data Validation

The app includes a comprehensive data validation system:

- **Real vs Estimated Data** tracking
- **Suspicious Pattern Detection** (duplicate prices, funding rates)
- **Quality Scoring** (0-100 scale)
- **Automatic Blocking** of unrealistic data
- **Data Source Transparency** (GMX_API, DUNE_ESTIMATED, FALLBACK)

## 📱 Navigation

- **Home** - Dashboard overview with market metrics
- **Pools** - High-yield pools with hedge detection  
- **Perps** - Perpetual markets data across 4 platforms
- **DN Model** - **Multi-chain CLM position dashboard** (main feature)

## 🎯 CLM Position Tracking

### Current Portfolio Coverage
- **7 Active Positions** across Solana and SUI
- **$63.6K Total TVL** in tracked positions
- **100% In-Range** status for all active positions

### Supported Protocols
- **Orca** (Solana): Whirlpool positions with tick ranges
- **Raydium** (Solana): CLMM positions extracted from NFT data
- **CETUS** (SUI): Concentrated liquidity with perfect accuracy

### Position Features
- **Automatic Discovery**: Wallet scanning finds all positions
- **Real-Time Ranges**: Live price vs. range visualization
- **USD Normalization**: Comparable liquidity across chains
- **Status Indicators**: Immediate visual feedback on position health

## 🔄 Real-time Updates

- Pool APY and TVL refresh on page load
- Perpetual market data from live APIs
- Hedge availability calculated dynamically
- Data quality validation on every request

## 🌐 Multi-chain Support

**Supported Chains:**
- Ethereum, Arbitrum, Optimism, Base, Polygon
- Solana, Sui, Avalanche, BSC
- Hyperliquid L1

**Protocol Coverage:**
- 100+ DeFi protocols
- 324+ perpetual trading pairs
- Real-time cross-chain data

## 📁 Project Structure

```
DN_Model/
├── app/
│   ├── api/
│   │   ├── gmx-dune/       # Dune Analytics integration
│   │   └── gmx-proxy/      # GMX Integration API proxy
│   ├── layout.tsx          # App layout
│   └── page.tsx            # Main dashboard
├── components/
│   ├── TopPoolsTab.tsx     # Pools with hedge detection
│   ├── PerpetualTab.tsx    # Perpetual markets display
│   └── SimplifiedHome.tsx  # Dashboard home
├── lib/
│   ├── hedge-detector.ts   # Delta neutral analysis engine
│   ├── defillama-api.ts    # DeFiLlama API client
│   └── store.ts            # Zustand state management
├── perpetual-markets.md    # Complete perpetual pairs database
└── README.md
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
# Add your API keys
```

3. **Run development server:**
```bash
npm run dev
```

4. **Open in browser:**
http://localhost:3000

---

Built with ❤️ for the DeFi community