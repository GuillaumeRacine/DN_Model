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

### **1. Automatic Data Refresh System** (`lib/data-cache.ts`)

**Purpose:** Manages automatic data refresh every 60 minutes with intelligent caching to reduce API calls and improve performance.

**Key Features:**
```typescript
dataCache.set(key, data, source)    // Cache data with 60min TTL
dataCache.get(key)                  // Retrieve cached data if valid
cacheHelpers.getTokenPrices()       // Token prices with fallback
autoRefreshManager.startAutoRefresh() // 60min auto-refresh
```

**Cache Flow:**
1. API request → Check cache first
2. Cache hit → Return cached data instantly
3. Cache miss/expired → Fetch fresh data
4. Store in cache with 60-minute expiration
5. Auto-cleanup expired entries every 10 minutes
6. Manual refresh bypasses cache entirely

### **2. Global Refresh Status** (`components/RefreshStatus.tsx`)

**Purpose:** Displays real-time refresh timestamps and provides manual refresh functionality across all pages.

**Key Features:**
- Shows "Last updated: X minutes ago" 
- Countdown to next auto-refresh
- Manual refresh button with loading states
- Real-time clock updates every second

### **3. API Architecture**

**`/api/gmx-dune`** - Dune Analytics Integration
- Uses `@duneanalytics/client-sdk`
- Fetches comprehensive GMX V2 market list (77 Arbitrum perpetual markets)
- Provides market structure and contract addresses

**`/api/gmx-proxy`** - Real-time Price Data  
- Proxies GMX Integration API to avoid CORS
- Provides live prices, OI, and volume for 4 major perpetual markets
- Used to enhance Dune data with real pricing

### **4. State Management** (`lib/store.ts`)

**Enhanced Zustand Store with Refresh Management:**
```typescript
interface AppState {
  viewMode: 'home' | 'pools' | 'dn model' | 'endpoints';
  isRefreshing: boolean;
  lastRefreshTime: Date | null;
  nextRefreshTime: Date | null;
  triggerManualRefresh: () => Promise<void>;
}
```

**Global Refresh State:** Centralized refresh management across all components with real-time status tracking.

### **5. Data Flow**

**Home Tab Flow (with Caching):**
1. `SimplifiedHome.tsx` requests token prices
2. Cache checked first → Return cached data if valid
3. Cache miss → Fetch from DeFiLlama Pro API
4. Fallback to CoinGecko if DeFiLlama fails
5. Data cached for 60 minutes + RefreshStatus updated

**Pools Tab Flow (with Caching):**
1. `TopPoolsTab.tsx` requests yield pools
2. Cache checked first → Return cached data if valid
3. Cache miss → Fetch from DeFiLlama Pro API
4. Data cached for 60 minutes + RefreshStatus updated

**CLM Positions Tab Flow:**
1. `CLMPositionDashboard.tsx` loads real position data
2. ONLY real positions displayed (no mock data)
3. Position analysis with price ranges and APR tracking
4. RefreshStatus shows position data freshness

**Endpoints Tab Flow:**
1. `EndpointsTab.tsx` fetches from `/api/health`
2. Real-time API status monitoring
3. Shows working/degraded/failing APIs with fallbacks
4. Comprehensive recommendations for API issues

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

1. **60-Minute Data Caching**: 99% reduction in API calls with intelligent TTL
2. **Instant Cache Responses**: Sub-millisecond data loading from cache
3. **Automatic Fallbacks**: DeFiLlama Pro → CoinGecko → Cached data
4. **Real-time Status Updates**: Global refresh state management
5. **Background Cache Cleanup**: Automatic expired entry removal
6. **Manual Refresh Override**: Bypass cache for immediate fresh data

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

## 🧪 Testing & Debugging Protocol

**CRITICAL FINAL STEP:** Always test new code thoroughly and ensure accurate data display before considering any task complete.

### **📋 Mandatory Testing Checklist**

**🔴 BEFORE MARKING ANY TASK COMPLETE:**

1. **✅ Functional Testing**
   ```bash
   npm run dev          # Start development server
   # Navigate to http://localhost:3002
   # Test ALL affected components/features
   # Verify data loads correctly
   # Check console for errors
   ```

2. **✅ Data Accuracy Validation**
   - Compare displayed data with source APIs
   - Verify calculations are mathematically correct
   - Check edge cases (empty data, API failures)
   - Confirm UI displays match expected values

3. **✅ Cross-Component Integration**
   - Test component interactions
   - Verify state management works correctly
   - Check data flows between components
   - Ensure no broken dependencies

4. **✅ Error Handling**
   - Test with failed API calls
   - Verify graceful fallbacks work
   - Check error messages are user-friendly
   - Ensure no unhandled promise rejections

5. **✅ Performance & Console Health**
   ```bash
   # Check browser console for:
   - No console errors (red)
   - No unhandled warnings (yellow)
   - No infinite re-renders
   - No memory leaks in long sessions
   ```

### **🔍 Debugging Process**

**When Issues Are Found:**

1. **Isolate the Problem**
   - Use browser dev tools
   - Add console.log statements
   - Check network tab for API calls
   - Verify data structures

2. **Fix & Re-test**
   - Address root cause, not just symptoms
   - Test fix in isolation
   - Re-run full testing checklist
   - Document what was fixed

3. **Validate Resolution**
   - Confirm original issue is resolved
   - Check no new issues were introduced
   - Test related functionality still works
   - Update documentation if needed

### **📊 Test Data Verification**

**For Financial/Trading Data:**
- ✅ Prices within realistic ranges
- ✅ Percentages properly formatted (e.g., 12.5%, not 0.125)
- ✅ Currency values show correct decimal places
- ✅ Large numbers use appropriate formatting (1.2M, not 1200000)
- ✅ Null/undefined values handled gracefully

**For Position/Portfolio Data:**
- ✅ Position values sum correctly
- ✅ Token amounts match expected precision
- ✅ Status indicators reflect reality
- ✅ Historical data shows realistic patterns
- ✅ All position types display properly

### **🚫 CRITICAL: NO MOCK DATA POLICY**

**❌ NEVER CREATE MOCK, FAKE, OR PLACEHOLDER DATA**
- **ONLY display real, timely, and accurate data from live APIs**
- **Show "N/A" or empty states if real data is unavailable**
- **All USD values must be mathematically validated and sanity-checked**
- **Position values must be verified against expected ranges**
- **API endpoints must return genuine data, not simulated responses**
- **All monitoring and status indicators must reflect actual system state**

**Examples of FORBIDDEN practices:**
- Fake position data with hardcoded TVL values
- Mock API responses in endpoint monitoring
- Simulated portfolio balances
- Placeholder price ranges
- Estimated USD values without real calculation
- Any data that doesn't come from actual blockchain/API sources

**Math Validation Requirements:**
- ✅ USD values must be calculated from real token amounts × real prices
- ✅ Position ranges must reflect actual tick/price boundaries
- ✅ TVL calculations must sum to realistic totals
- ✅ APR/yield percentages must be within plausible ranges (0-1000%)
- ✅ Token amounts must respect decimal precision (e.g., USDC = 6 decimals)
- ✅ All calculations must be cross-validated against multiple sources when possible

### **🚨 Quality Gates**

**DO NOT COMPLETE ANY TASK UNTIL:**
- [ ] All console errors are resolved
- [ ] Data displays accurately in UI (REAL DATA ONLY)
- [ ] User interactions work smoothly
- [ ] Error states are handled gracefully
- [ ] Performance is acceptable
- [ ] Code changes don't break existing features
- [ ] Math validation confirms all USD values are realistic
- [ ] API endpoints return genuine, not simulated data

### **💡 Testing Commands**

```bash
# Essential testing commands
npm run dev          # Development server
npm run build        # Test production build
npm run lint         # Check code quality
npm run type-check   # Verify TypeScript

# Debug specific issues
node scripts/test-api.js           # Test API connections
node scripts/position-scanner.js   # Scan for positions
node scripts/add-position.js       # Test position management
```

### **📝 Testing Documentation**

**When Adding New Features:**
1. Document test cases in comments
2. Create test data examples
3. List known limitations
4. Provide debugging instructions

**Example:**
```typescript
// TEST CASES:
// ✅ Valid position NFT detection
// ✅ Multiple positions display
// ✅ Error handling for failed API calls
// ✅ Loading states work correctly
// ❌ Known limitation: RPC rate limiting
```

---

**⚡ REMEMBER: Code that works in theory but fails in practice is not complete. Always test until the data is accurate and the user experience is smooth.**

---

**Built for:** Delta neutral CLM strategies, DeFi yield farming, risk management
**Target Users:** Advanced DeFi traders, yield farmers, risk managers