// Database utility functions for CLM Analytics
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class AnalyticsDB {
    constructor() {
        this.dbPath = path.join(__dirname, '../database/analytics.db');
        this.db = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Ensure database directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // Open database connection
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err.message);
                    throw err;
                }
                console.log('✅ Connected to SQLite database:', this.dbPath);
            });

            // Enable foreign keys
            await this.run('PRAGMA foreign_keys = ON');

            // Load schema if database is new
            await this.loadSchema();
            
            this.isInitialized = true;
            console.log('✅ Database initialized successfully');
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    async loadSchema() {
        try {
            const schemaPath = path.join(__dirname, '../database/schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                
                // Remove all comments first, then split by semicolons
                const cleanedSchema = schema
                    .split('\n')
                    .map(line => {
                        const commentIndex = line.indexOf('--');
                        return commentIndex !== -1 ? line.substring(0, commentIndex) : line;
                    })
                    .join('\n');
                
                // Split by semicolons and filter valid statements
                const statements = cleanedSchema
                    .split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt && stmt.length > 5); // Must be at least a short SQL statement
                
                for (const statement of statements) {
                    if (statement.trim()) {
                        await this.run(statement);
                    }
                }
                console.log('✅ Database schema loaded');
            }
        } catch (error) {
            console.error('❌ Error loading schema:', error);
            throw error;
        }
    }

    // Promisified database operations
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Database run error:', err.message);
                    console.error('SQL:', sql);
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('❌ Database get error:', err.message);
                    console.error('SQL:', sql);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ Database all error:', err.message);
                    console.error('SQL:', sql);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Specialized methods for our schema
    async insertPriceData(data) {
        const sql = `
            INSERT INTO price_data (timestamp, pool_address, network, price, volume_usd, log_return)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        return this.run(sql, [
            data.timestamp,
            data.pool_address,
            data.network,
            data.price,
            data.volume_usd,
            data.log_return
        ]);
    }

    async insertPool(poolData) {
        const sql = `
            INSERT OR REPLACE INTO pools 
            (pool_address, network, token_pair, token0_address, token1_address, 
             token0_symbol, token1_symbol, fee_tier, protocol)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        return this.run(sql, [
            poolData.pool_address,
            poolData.network,
            poolData.token_pair,
            poolData.token0_address,
            poolData.token1_address,
            poolData.token0_symbol,
            poolData.token1_symbol,
            poolData.fee_tier,
            poolData.protocol
        ]);
    }

    async updatePoolAnalytics(analytics) {
        const sql = `
            INSERT OR REPLACE INTO pool_analytics 
            (pool_address, network, token_pair, tvl_usd, volume_24h, fees_24h, 
             apy_base, apy_reward, volatility_1d, volatility_7d, volatility_30d,
             fvr, il_risk_score, recommendation, expected_il_30d, breakeven_fee_apr,
             data_points_count, oldest_data_timestamp, newest_data_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        return this.run(sql, [
            analytics.pool_address,
            analytics.network,
            analytics.token_pair,
            analytics.tvl_usd,
            analytics.volume_24h,
            analytics.fees_24h,
            analytics.apy_base,
            analytics.apy_reward,
            analytics.volatility_1d,
            analytics.volatility_7d,
            analytics.volatility_30d,
            analytics.fvr,
            analytics.il_risk_score,
            analytics.recommendation,
            analytics.expected_il_30d,
            analytics.breakeven_fee_apr,
            analytics.data_points_count,
            analytics.oldest_data_timestamp,
            analytics.newest_data_timestamp
        ]);
    }

    async getPoolAnalytics(poolAddress) {
        const sql = `
            SELECT pa.*, p.protocol, p.fee_tier
            FROM pool_analytics pa
            JOIN pools p ON pa.pool_address = p.pool_address
            WHERE pa.pool_address = ?
        `;
        return this.get(sql, [poolAddress]);
    }

    async getTopPoolsByFVR(limit = 100, minTVL = 1000000) {
        const sql = `
            SELECT pa.*, p.protocol, p.fee_tier
            FROM pool_analytics pa
            JOIN pools p ON pa.pool_address = p.pool_address
            WHERE pa.fvr IS NOT NULL 
            AND pa.tvl_usd >= ?
            ORDER BY pa.fvr DESC
            LIMIT ?
        `;
        return this.all(sql, [minTVL, limit]);
    }

    async getPriceHistory(poolAddress, days = 30) {
        const sql = `
            SELECT timestamp, price, log_return, volume_usd
            FROM price_data
            WHERE pool_address = ?
            AND timestamp >= datetime('now', '-${days} days')
            ORDER BY timestamp ASC
        `;
        return this.all(sql, [poolAddress]);
    }

    async getActivePositions() {
        const sql = `
            SELECT up.*, pa.fvr, pa.volatility_30d, pa.recommendation, p.token_pair, p.protocol
            FROM user_positions up
            LEFT JOIN pool_analytics pa ON up.pool_address = pa.pool_address
            LEFT JOIN pools p ON up.pool_address = p.pool_address
            WHERE up.position_type = 'active'
            ORDER BY pa.fvr DESC
        `;
        return this.all(sql);
    }

    async getWatchlistPools() {
        const sql = `
            SELECT DISTINCT up.pool_address, up.network, p.token_pair
            FROM user_positions up
            JOIN pools p ON up.pool_address = p.pool_address
            WHERE up.position_type IN ('active', 'watchlist')
        `;
        return this.all(sql);
    }

    // API usage tracking
    async trackAPIUsage(service, endpoint) {
        const dateHour = new Date().toISOString().slice(0, 13).replace('T', '-');
        const sql = `
            INSERT INTO api_usage (service, endpoint, date_hour, requests_count)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(service, endpoint, date_hour) 
            DO UPDATE SET requests_count = requests_count + 1
        `;
        return this.run(sql, [service, endpoint, dateHour]);
    }

    async getAPIUsage(service, hoursBack = 1) {
        const sql = `
            SELECT SUM(requests_count) as total_requests
            FROM api_usage
            WHERE service = ?
            AND datetime(date_hour || ':00:00') >= datetime('now', '-${hoursBack} hours')
        `;
        const result = await this.get(sql, [service]);
        return result?.total_requests || 0;
    }

    // Utility methods
    async getTableCounts() {
        const tables = ['price_data', 'pools', 'pool_analytics', 'user_positions'];
        const counts = {};
        
        for (const table of tables) {
            const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
            counts[table] = result.count;
        }
        
        return counts;
    }

    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Database connection closed');
                        resolve();
                    }
                });
            });
        }
    }
}

// Export singleton instance
const analyticsDB = new AnalyticsDB();
module.exports = analyticsDB;