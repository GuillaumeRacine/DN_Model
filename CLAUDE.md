# CLAUDE.md - Technical Documentation

## 🏗️ Project Architecture

### **Core Concept**
DN_Model is a DeFi analytics dashboard focused on identifying pools suitable for **delta neutral CLM (Concentrated Liquidity Management)** strategies by cross-referencing pool tokens with available perpetual markets for hedging.

## 📁 File Structure

```
DN_Model/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── gmx-dune/      # Dune Analytics integration
│   │   └── gmx-proxy/     # GMX Integration API proxy
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Main dashboard (simplified)
├── components/            # React Components (core only)
│   ├── TopPoolsTab.tsx    # Pools with hedge detection
│   ├── PerpetualTab.tsx   # Perpetual markets display  
│   └── SimplifiedHome.tsx # Dashboard overview
├── lib/                   # Utilities & Logic
│   ├── hedge-detector.ts  # Delta neutral analysis engine
│   ├── defillama-api.ts   # DeFiLlama API client
│   └── store.ts          # Zustand state (minimal)
├── perpetual-markets.md   # Static perpetual pairs database
├── README.md             # User documentation
└── CLAUDE.md            # This technical doc
```

## 🔧 Key Technical Components

### **1. Hedge Detection Engine** (`lib/hedge-detector.ts`)

**Purpose:** Identifies which pools can achieve delta neutral exposure by checking if their volatile tokens have available perpetual hedges.

**Key Functions:**
```typescript
parsePoolSymbol(symbol: string): string[]
// Extracts tokens from pool symbols (e.g., "ETH-USDC" → ["ETH", "USDC"])

findTokenHedges(token: string): HedgeAvailability[]
// Finds all perpetual markets available for hedging a specific token

analyzePoolHedges(poolSymbol: string): PoolAnalysis
// Comprehensive analysis of a pool's hedge potential

generateHedgeSummary(poolSymbol: string): HedgeSummary
// Simple Yes/No hedge availability for UI display
```

**Logic Flow:**
1. Parse pool symbol → Extract individual tokens
2. Normalize symbols (WETH→ETH, WBTC→BTC)
3. Filter out stablecoins (don't need hedging)
4. Check each volatile token against perpetual markets database
5. Calculate hedge coverage percentage
6. Determine if delta neutral is possible (all volatile tokens hedgeable)

### **2. API Architecture**

**`/api/gmx-dune`** - Dune Analytics Integration
- Uses `@duneanalytics/client-sdk`
- Fetches comprehensive GMX V2 market list (77 Arbitrum perpetual markets)
- Provides market structure and contract addresses

**`/api/gmx-proxy`** - Real-time Price Data  
- Proxies GMX Integration API to avoid CORS
- Provides live prices, OI, and volume for 4 major perpetual markets
- Used to enhance Dune data with real pricing

### **3. State Management** (`lib/store.ts`)

**Simplified Zustand Store:**
```typescript
interface AppState {
  viewMode: 'home' | 'pools' | 'perps' | 'dn model';
  setViewMode: (mode) => void;
}
```

**Design Decision:** Removed complex filtering state since chain filters were removed for simplicity.

### **4. Data Flow**

**Pools Tab Flow:**
1. `TopPoolsTab.tsx` fetches pools from DeFiLlama API
2. For each pool: `generateHedgeSummary()` analyzes hedge availability  
3. UI displays "Yes/No" hedge status + delta neutral filter
4. User can filter to show only delta neutral pools

**Perpetual Tab Flow:**
1. `PerpetualTab.tsx` fetches from `/api/gmx-dune` (comprehensive list)
2. Enhances with real prices from `/api/gmx-proxy` where available
3. Data validation system checks quality before display
4. Shows 77 markets with real/estimated data indicators

## 🛡️ Data Validation System

**Comprehensive Quality Checks:**

1. **Real vs Estimated Tracking**
   - `isRealData` flag on each data point
   - `dataSource` tracking (GMX_API, DUNE_ESTIMATED, FALLBACK)

2. **Suspicious Pattern Detection**
   - Duplicate prices across markets
   - Identical funding rates (previous bug indicator)
   - Unrealistic OI imbalances (all zeros)

3. **Quality Scoring (0-100)**
   - Penalizes low real data percentage
   - Penalizes suspicious patterns (-15 points each)
   - Penalizes data warnings (-5 points each)
   - **Blocks display if score < 60**

4. **Price Reality Checks**
   - BTC: $30K-$200K range validation
   - ETH: $1K-$20K range validation
   - Volume/OI ratio realism checks

## 🎯 Delta Neutral Strategy Logic

**Pool Analysis Process:**

```typescript
// Example: ETH-USDC pool
Pool Symbol: "ETH-USDC"
↓
Parse: ["ETH", "USDC"]
↓  
Filter Volatile: ["ETH"] // USDC removed as stablecoin
↓
Find Hedges: [
  { token: "ETH", protocol: "Hyperliquid", pair: "ETH/USD" },
  { token: "ETH", protocol: "GMX V2", pair: "ETH/USD" },
  { token: "ETH", protocol: "Drift", pair: "ETH-PERP" }
]
↓
Result: ✅ Delta Neutral Possible (100% volatile tokens hedgeable)
```

**Key Insight:** Delta neutral is possible when `hedgeableTokens.length === volatileTokens.length`

## 📊 Perpetual Markets Database

**Static Database Coverage:**
- **Hyperliquid**: 176+ pairs (L1 blockchain)
- **Drift**: 75 pairs (Solana)
- **GMX V2**: 70+ pairs (Arbitrum) 
- **Jupiter**: 3 pairs (Solana blue-chip)

**Priority Order** (by liquidity):
1. Hyperliquid (80% DEX perp market share)
2. GMX V2 (deep Arbitrum liquidity)
3. Drift (comprehensive Solana ecosystem)
4. Jupiter (focused strategy)

## 🔄 Data Sources & APIs

### **Pool Data Sources:**
- **DeFiLlama Pro API**: Pool metrics, APY, TVL, volume
- **Real-time**: Fresh data on every request
- **Multi-protocol**: Uniswap V3, Aerodrome, Raydium, etc.

### **Perpetual Data Sources:**
- **Dune Analytics**: Comprehensive market structure (77 markets)
- **GMX Integration API**: Real prices/OI for 4 major markets
- **Static DB**: Other platform mappings (Hyperliquid, Drift, Jupiter)

## 🎨 UI/UX Design Decisions

### **Simplified Navigation**
- Removed chain filters (unused by user)
- Removed metrics cards (cleaner interface)
- Focus on core functionality: pools + hedge detection

### **Clear Visual Indicators**
- **Green "Yes"** pill = Hedge available
- **Red "No"** pill = No hedge available  
- **Delta Neutral Filter** = Show only CLM-suitable pools
- **Real data badges** = Transparency on data sources

## 🚀 Performance Optimizations

1. **API Caching**: Next.js built-in caching for API routes
2. **Parallel Requests**: Dune + GMX APIs called simultaneously  
3. **Client-side Filtering**: Delta neutral filter instant response
4. **Lazy Loading**: Components load data on demand
5. **Error Boundaries**: Graceful fallbacks for API failures

## 🔧 Development Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build  
npm run start        # Start production server

# Useful for debugging
npm run lint         # ESLint check
npm run type-check   # TypeScript validation
```

## 🧩 Extension Points

**Future Enhancements:**

1. **Advanced Analytics Tab** ("DN Model")
   - Historical hedge ratios
   - Risk/reward analysis
   - Portfolio optimization

2. **Real-time Monitoring**
   - WebSocket connections for live data
   - Price alerts for hedge opportunities
   - Automated rebalancing suggestions

3. **Cross-chain Expansion**  
   - More perpetual platforms
   - Cross-chain hedge strategies
   - Multi-token pool analysis

## 🐛 Known Limitations

1. **Volume Data**: Some APIs show 0 volume (limitation, not bug)
2. **Funding Rates**: Estimated based on OI imbalance patterns
3. **Price Delays**: APIs may have slight delays vs exchange data
4. **Static Perp DB**: Some platforms require manual updates

## 📝 Code Quality

**TypeScript Coverage**: 100% (strict mode)
**Component Architecture**: Functional components with hooks
**Error Handling**: Comprehensive try/catch with user feedback
**Performance**: Optimized for large datasets (100+ pools)

---

**Built for:** Delta neutral CLM strategies, DeFi yield farming, risk management
**Target Users:** Advanced DeFi traders, yield farmers, risk managers