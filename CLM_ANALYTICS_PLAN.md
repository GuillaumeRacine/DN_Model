# 📊 CLM Analytics Implementation Plan

## **🎯 Project Overview**

Build a cost-effective ($15/month) CLM position optimization system using:
- **6 months historical data** from free APIs 
- **Hourly updates** for active positions
- **Math.md formulas** for volatility, FVR, and IL calculations
- **Top 100 pools screening** with real-time recommendations

---

## **📋 Implementation Phases**

### **Phase 1: Data Infrastructure** (Week 1)
**Goal:** Set up data collection and storage system

#### **Task 1.1: Database Schema**
- [ ] Create SQLite database with optimized schema
- [ ] Add indexes for fast time-series queries
- [ ] Create analytics tables for calculated metrics

#### **Task 1.2: Historical Data Backfill**
- [ ] Implement GeckoTerminal API integration
- [ ] Collect 6 months of hourly OHLC data
- [ ] Process and store price data with log returns
- [ ] Validate data quality and completeness

#### **Task 1.3: Pool Metadata Integration**
- [ ] Integrate DeFiLlama Pools API
- [ ] Collect pool metadata (TVL, APY, fees)
- [ ] Map pool addresses across networks
- [ ] Store pool configuration data

---

### **Phase 2: Analytics Engine** (Week 2)
**Goal:** Implement mathematical calculations from math.md

#### **Task 2.1: Volatility Calculator**
- [ ] Implement rolling volatility calculation
- [ ] Support 1d, 7d, 30d windows
- [ ] Annualization with proper frequency scaling
- [ ] Validation against known volatility ranges

#### **Task 2.2: FVR Calculator**
- [ ] Implement Fee-to-Volatility Ratio formula
- [ ] Pool-level and position-level calculations
- [ ] FVR signal classification (attractive/fair/overpriced)
- [ ] Time-series tracking of FVR changes

#### **Task 2.3: IL Estimator**
- [ ] Path-based IL calculation using math.md formulas
- [ ] Concentrated liquidity range adjustments
- [ ] Historical backtesting framework
- [ ] IL risk scoring system

---

### **Phase 3: Real-time Collection** (Week 3)
**Goal:** Set up hourly data collection and processing

#### **Task 3.1: Tiered Update System**
- [ ] Tier 1: Hourly updates for active positions
- [ ] Tier 2: 6-hourly updates for watchlist
- [ ] Tier 3: Daily updates for top 100 screening
- [ ] Smart prioritization based on volatility

#### **Task 3.2: Data Processing Pipeline**
- [ ] Real-time volatility updates
- [ ] FVR recalculation triggers
- [ ] Alert system for threshold breaches
- [ ] Data quality monitoring

#### **Task 3.3: Cron Job Setup**
- [ ] Hourly collection script
- [ ] Error handling and retry logic
- [ ] Logging and monitoring
- [ ] Backup and recovery procedures

---

### **Phase 4: Dashboard Integration** (Week 4)
**Goal:** Add analytics to existing DN Model dashboard

#### **Task 4.1: API Endpoints**
- [ ] `/api/pool-analytics` - Get pool metrics
- [ ] `/api/position-optimization` - Position recommendations
- [ ] `/api/historical-analysis` - Backtest results
- [ ] Rate limiting and caching

#### **Task 4.2: UI Components**
- [ ] Enhanced TopPoolsTab with FVR metrics
- [ ] Volatility charts and visualizations
- [ ] Position optimization recommendations
- [ ] Historical performance charts

#### **Task 4.3: Real-time Updates**
- [ ] WebSocket integration for live data
- [ ] Automatic refresh mechanisms
- [ ] Loading states and error handling
- [ ] Mobile-responsive design

---

## **🛠️ Technical Architecture**

### **Data Stack**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  GeckoTerminal  │    │   DeFiLlama      │    │    SQLite       │
│   (OHLC Data)   │───▶│  (Pool Metadata) │───▶│  (Storage)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cron Jobs     │    │   Analytics      │    │   Next.js API   │
│  (Collection)   │───▶│    Engine        │───▶│  (Dashboard)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **File Structure**
```
DN_Model/
├── analytics/                    # New analytics system
│   ├── database/
│   │   ├── schema.sql           # Database schema
│   │   ├── migrations.sql       # Schema updates
│   │   └── seed.sql            # Initial data
│   ├── collectors/
│   │   ├── historical-backfill.js     # One-time data collection
│   │   ├── hourly-collector.js        # Ongoing updates
│   │   └── pool-metadata.js           # Pool information
│   ├── calculators/
│   │   ├── volatility.js             # Volatility calculations
│   │   ├── fvr.js                    # FVR calculations
│   │   └── impermanent-loss.js       # IL estimation
│   ├── utils/
│   │   ├── api-client.js             # API integration helpers
│   │   ├── database.js               # Database utilities
│   │   └── math-helpers.js           # Math.md implementations
│   └── scripts/
│       ├── setup.js                  # Initial setup
│       ├── backfill.js              # Historical data collection
│       └── validate.js              # Data validation
├── app/api/
│   ├── pool-analytics/
│   │   └── route.ts                  # Pool analytics API
│   ├── historical-analysis/
│   │   └── route.ts                  # Historical data API
│   └── position-optimization/
│       └── route.ts                  # Position recommendations
├── components/
│   ├── analytics/
│   │   ├── FVRChart.tsx             # FVR visualization
│   │   ├── VolatilityChart.tsx      # Volatility charts
│   │   └── PositionOptimizer.tsx    # Position recommendations
│   └── enhanced/
│       └── EnhancedTopPoolsTab.tsx   # Enhanced pools view
└── lib/
    ├── analytics-api.ts              # Client-side API calls
    └── math-formulas.ts              # Math.md formula implementations
```

---

## **📊 Database Schema Design**

### **Core Tables**
```sql
-- Price data (time-series)
CREATE TABLE price_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    pool_address TEXT NOT NULL,
    network TEXT NOT NULL,
    price REAL NOT NULL,
    volume_usd REAL,
    log_return REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pool_time (pool_address, timestamp),
    INDEX idx_network_time (network, timestamp)
);

-- Pool metadata
CREATE TABLE pools (
    pool_address TEXT PRIMARY KEY,
    network TEXT NOT NULL,
    token_pair TEXT NOT NULL,
    token0_address TEXT,
    token1_address TEXT,
    fee_tier REAL,
    protocol TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics (calculated metrics)
CREATE TABLE pool_analytics (
    pool_address TEXT PRIMARY KEY,
    network TEXT NOT NULL,
    token_pair TEXT NOT NULL,
    
    -- Current metrics
    tvl_usd REAL,
    volume_24h REAL,
    fees_24h REAL,
    apy_base REAL,
    
    -- Volatility metrics
    volatility_1d REAL,
    volatility_7d REAL,
    volatility_30d REAL,
    
    -- Calculated metrics
    fvr REAL,
    il_risk_score INTEGER,
    recommendation TEXT,
    
    -- Metadata
    data_points_count INTEGER,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pool_address) REFERENCES pools(pool_address)
);

-- User positions (for tier-based updates)
CREATE TABLE user_positions (
    id INTEGER PRIMARY KEY,
    pool_address TEXT NOT NULL,
    network TEXT NOT NULL,
    position_type TEXT DEFAULT 'active', -- active, watchlist, screening
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pool_address) REFERENCES pools(pool_address)
);
```

---

## **🔧 Implementation Details**

### **API Integration Patterns**
```javascript
// Rate-limited API client
class APIClient {
    constructor(baseURL, rateLimit = 30) {
        this.baseURL = baseURL;
        this.rateLimit = rateLimit; // requests per minute
        this.requestQueue = [];
    }
    
    async get(endpoint, params = {}) {
        await this.throttle();
        return fetch(`${this.baseURL}${endpoint}?${new URLSearchParams(params)}`);
    }
    
    async throttle() {
        // Implement rate limiting
        const now = Date.now();
        this.requestQueue = this.requestQueue.filter(time => now - time < 60000);
        
        if (this.requestQueue.length >= this.rateLimit) {
            const waitTime = 60000 - (now - this.requestQueue[0]);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.requestQueue.push(now);
    }
}
```

### **Math.md Formula Implementation**
```javascript
// Volatility calculation (math.md Section 3)
function calculateAnnualizedVolatility(returns, frequency = 'hourly') {
    const frequencies = {
        'hourly': 24 * 365,
        'daily': 365,
        '15min': 4 * 24 * 365
    };
    
    const variance = returns.reduce((sum, r) => sum + r * r, 0) / returns.length;
    const stddev = Math.sqrt(variance);
    
    return stddev * Math.sqrt(frequencies[frequency]);
}

// FVR calculation (math.md Section 3)
function calculateFVR(feeAPR, volatility) {
    if (volatility === 0) return 0;
    return feeAPR / volatility;
}

// IL estimation (math.md Section 4)
function estimateImpermanentLoss(priceRatio, isConcentrated = true) {
    // Constant product formula
    const ilCP = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
    
    // Concentration adjustment
    if (isConcentrated) {
        return ilCP * 1.5; // Rough approximation
    }
    
    return ilCP;
}
```

---

## **🚀 Deployment Strategy**

### **Development Environment**
```bash
# 1. Setup local development
cd DN_Model
npm install
mkdir -p analytics/{database,collectors,calculators,utils,scripts}

# 2. Initialize SQLite database
sqlite3 analytics/database/analytics.db < analytics/database/schema.sql

# 3. Install Python dependencies (for data collection)
pip install requests sqlite3 schedule python-dotenv

# 4. Run historical backfill (one-time)
node analytics/scripts/backfill.js

# 5. Setup cron job
crontab -e
# Add: 0 * * * * cd /path/to/DN_Model && node analytics/collectors/hourly-collector.js
```

### **Production Deployment**
```bash
# 1. DigitalOcean Droplet ($6/month)
# Ubuntu 22.04, 1GB RAM, 25GB SSD

# 2. Install dependencies
sudo apt update
sudo apt install nodejs npm sqlite3 python3 python3-pip

# 3. Setup application
git clone https://github.com/your-repo/DN_Model.git
cd DN_Model
npm install
npm run build

# 4. Setup process manager
pm2 start npm --name "dn-model" -- start
pm2 startup
pm2 save

# 5. Setup reverse proxy (nginx)
sudo apt install nginx
# Configure nginx for Next.js app

# 6. Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

---

## **📈 Testing & Validation Strategy**

### **Data Quality Tests**
```javascript
// Test volatility calculations
function testVolatilityCalculation() {
    const mockReturns = [0.02, -0.01, 0.03, -0.02, 0.01]; // Mock daily returns
    const expectedVol = 0.02 * Math.sqrt(365); // ~38% annualized
    
    const calculatedVol = calculateAnnualizedVolatility(mockReturns, 'daily');
    assert(Math.abs(calculatedVol - expectedVol) < 0.01, 'Volatility calculation error');
}

// Test FVR classification
function testFVRClassification() {
    assert(classifyFVR(1.2) === 'attractive', 'FVR > 1.0 should be attractive');
    assert(classifyFVR(0.8) === 'fair', 'FVR 0.6-1.0 should be fair');
    assert(classifyFVR(0.4) === 'overpriced', 'FVR < 0.6 should be overpriced');
}
```

### **Performance Benchmarks**
- Database query performance: < 100ms for analytics queries
- API response time: < 500ms for pool analytics
- Data collection time: < 5 minutes for hourly updates
- Historical backfill: < 2 hours for 6 months data

---

## **💰 Cost Monitoring**

### **Monthly Budget Breakdown**
| Component | Cost | Notes |
|-----------|------|-------|
| DigitalOcean Droplet | $6 | 1GB RAM, sufficient for SQLite |
| Domain + SSL | $5 | Optional, can use IP |
| Backup Storage | $2 | Database backups |
| Monitoring | $2 | Uptime monitoring |
| **Total** | **$15** | **vs $650+ enterprise** |

### **API Usage Monitoring**
```javascript
// Track API usage to stay within free limits
const apiUsage = {
    geckoTerminal: { limit: 30, used: 0, resetTime: Date.now() + 60000 },
    defiLlama: { limit: 100, used: 0, resetTime: Date.now() + 3600000 }
};

function trackAPIUsage(service) {
    const usage = apiUsage[service];
    if (Date.now() > usage.resetTime) {
        usage.used = 0;
        usage.resetTime = Date.now() + (service === 'geckoTerminal' ? 60000 : 3600000);
    }
    usage.used++;
}
```

---

## **🔍 Success Metrics**

### **Week 1 Deliverables**
- [ ] SQLite database with schema
- [ ] Historical data for 50+ top pools (6 months)
- [ ] Basic volatility calculations working
- [ ] Pool metadata integration complete

### **Week 2 Deliverables**
- [ ] FVR calculations for all pools
- [ ] IL estimation framework
- [ ] Top 100 pools ranked by FVR
- [ ] Basic API endpoints functional

### **Week 3 Deliverables**
- [ ] Hourly data collection running
- [ ] Tiered update system operational
- [ ] Alert system for FVR thresholds
- [ ] Production deployment complete

### **Week 4 Deliverables**
- [ ] Dashboard integration complete
- [ ] Real-time charts and visualizations
- [ ] Position optimization recommendations
- [ ] User documentation and guides

---

## **🎯 Next Actions**

1. **Create database schema** and initialize SQLite
2. **Implement historical backfill** for top 50 pools
3. **Test volatility calculations** against known values
4. **Build basic API endpoints** for dashboard integration
5. **Setup cron jobs** for hourly collection

**Ready to start implementation?** 🚀

The plan prioritizes getting valuable data quickly while building a foundation for advanced features. Each phase delivers immediate value while setting up the next phase.