-- CLM Analytics Database Schema
-- SQLite database for concentrated liquidity position analytics

-- Core price data (time-series)
CREATE TABLE IF NOT EXISTS price_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    pool_address TEXT NOT NULL,
    network TEXT NOT NULL,
    price REAL NOT NULL,
    volume_usd REAL,
    log_return REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_pool_time ON price_data(pool_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_network_time ON price_data(network, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_timestamp ON price_data(timestamp DESC);

-- Pool metadata
CREATE TABLE IF NOT EXISTS pools (
    pool_address TEXT PRIMARY KEY,
    network TEXT NOT NULL,
    token_pair TEXT NOT NULL,
    token0_address TEXT,
    token1_address TEXT,
    token0_symbol TEXT,
    token1_symbol TEXT,
    fee_tier REAL,
    protocol TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pool analytics (calculated metrics)
CREATE TABLE IF NOT EXISTS pool_analytics (
    pool_address TEXT PRIMARY KEY,
    network TEXT NOT NULL,
    token_pair TEXT NOT NULL,
    
    -- Current pool state
    tvl_usd REAL,
    volume_24h REAL,
    fees_24h REAL,
    apy_base REAL,
    apy_reward REAL,
    
    -- Volatility metrics (from math.md Section 3)
    volatility_1d REAL,
    volatility_7d REAL,
    volatility_30d REAL,
    
    -- Calculated metrics (from math.md)
    fvr REAL,                    -- Fee-to-Volatility Ratio
    il_risk_score INTEGER,       -- 1-10 scale
    recommendation TEXT,         -- 'attractive', 'fair', 'overpriced'
    
    -- Position-specific estimates (from math.md Section 4)
    expected_il_30d REAL,        -- Expected impermanent loss
    breakeven_fee_apr REAL,      -- Minimum APR to beat HODL
    
    -- Data quality metrics
    data_points_count INTEGER,
    oldest_data_timestamp DATETIME,
    newest_data_timestamp DATETIME,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pool_address) REFERENCES pools(pool_address)
);

-- User positions for tiered updates
CREATE TABLE IF NOT EXISTS user_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_address TEXT NOT NULL,
    network TEXT NOT NULL,
    position_type TEXT DEFAULT 'active', -- 'active', 'watchlist', 'screening'
    tick_lower INTEGER,
    tick_upper INTEGER,
    liquidity TEXT, -- Store as string to handle large numbers
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pool_address) REFERENCES pools(pool_address)
);

-- API usage tracking (to stay within free limits)
CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL, -- 'geckoterminal', 'defillama'
    endpoint TEXT NOT NULL,
    requests_count INTEGER DEFAULT 1,
    date_hour TEXT NOT NULL, -- 'YYYY-MM-DD-HH' format
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_hour 
ON api_usage(service, endpoint, date_hour);

-- Historical volatility snapshots (for trend analysis)
CREATE TABLE IF NOT EXISTS volatility_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_address TEXT NOT NULL,
    date DATE NOT NULL,
    volatility_value REAL NOT NULL,
    period_days INTEGER NOT NULL, -- 1, 7, or 30
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pool_address) REFERENCES pools(pool_address)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vol_history 
ON volatility_history(pool_address, date, period_days);

-- FVR history (for signal tracking)
CREATE TABLE IF NOT EXISTS fvr_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_address TEXT NOT NULL,
    date DATE NOT NULL,
    fvr_value REAL NOT NULL,
    fee_apr REAL NOT NULL,
    volatility REAL NOT NULL,
    recommendation TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pool_address) REFERENCES pools(pool_address)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fvr_history 
ON fvr_history(pool_address, date);

-- Alerts configuration
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_address TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'fvr_threshold', 'volatility_spike', 'il_warning'
    threshold_value REAL NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    last_triggered DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pool_address) REFERENCES pools(pool_address)
);

-- Views for common queries
CREATE VIEW IF NOT EXISTS top_pools_by_fvr AS
SELECT 
    pa.*,
    p.protocol,
    p.fee_tier,
    CASE 
        WHEN pa.fvr > 1.0 THEN 'attractive'
        WHEN pa.fvr > 0.6 THEN 'fair'
        ELSE 'overpriced'
    END as fvr_signal
FROM pool_analytics pa
JOIN pools p ON pa.pool_address = p.pool_address
WHERE pa.fvr IS NOT NULL
AND pa.tvl_usd > 1000000 -- Min $1M TVL
ORDER BY pa.fvr DESC;

CREATE VIEW IF NOT EXISTS active_positions_analytics AS
SELECT 
    up.*,
    pa.*,
    p.protocol,
    p.token_pair
FROM user_positions up
JOIN pool_analytics pa ON up.pool_address = pa.pool_address
JOIN pools p ON up.pool_address = p.pool_address
WHERE up.position_type = 'active'
ORDER BY pa.fvr DESC;

-- Initialize with example pools first
INSERT OR IGNORE INTO pools (pool_address, network, token_pair, token0_symbol, token1_symbol, protocol) VALUES
('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', 'eth', 'ETH/USDC', 'ETH', 'USDC', 'uniswap-v3'), -- ETH/USDC 0.05%
('0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8', 'eth', 'ETH/USDC', 'ETH', 'USDC', 'uniswap-v3'), -- ETH/USDC 0.3%
('0xcbcdf9626bc03e24f779434178a73a0b4bad62ed', 'eth', 'BTC/ETH', 'WBTC', 'ETH', 'uniswap-v3'), -- BTC/ETH 0.3%
('0x99ac8ca7087fa4a2a1fb6357269965a2014abc35', 'eth', 'BTC/USDC', 'WBTC', 'USDC', 'uniswap-v3'); -- BTC/USDC 0.3%

-- Then add user positions configuration
INSERT OR IGNORE INTO user_positions (pool_address, network, position_type) VALUES
('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', 'eth', 'active'), -- ETH/USDC 0.05%
('0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8', 'eth', 'active'), -- ETH/USDC 0.3%
('0xcbcdf9626bc03e24f779434178a73a0b4bad62ed', 'eth', 'watchlist'), -- BTC/ETH 0.3%
('0x99ac8ca7087fa4a2a1fb6357269965a2014abc35', 'eth', 'watchlist'); -- BTC/USDC 0.3%