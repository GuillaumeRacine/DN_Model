#!/usr/bin/env node
// Monitor analytics data collection progress

const analyticsDB = require('../utils/database');

async function monitorProgress() {
    try {
        await analyticsDB.initialize();
        
        // Get overall stats
        const stats = await analyticsDB.get(`
            SELECT 
                COUNT(DISTINCT pool_address) as total_pools,
                COUNT(*) as total_data_points,
                MIN(timestamp) as oldest_data,
                MAX(timestamp) as newest_data
            FROM price_data
        `);
        
        // Get per-pool breakdown
        const pools = await analyticsDB.all(`
            SELECT 
                p.token_pair,
                p.protocol,
                COUNT(pd.id) as data_points,
                MIN(pd.timestamp) as oldest,
                MAX(pd.timestamp) as newest,
                pa.volatility_30d,
                pa.fvr,
                pa.recommendation
            FROM pools p
            LEFT JOIN price_data pd ON p.pool_address = pd.pool_address
            LEFT JOIN pool_analytics pa ON p.pool_address = pa.pool_address
            GROUP BY p.pool_address
            ORDER BY data_points DESC
            LIMIT 20
        `);
        
        console.log('\n📊 Analytics Database Status');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Total Pools: ${stats.total_pools}`);
        console.log(`Total Data Points: ${stats.total_data_points?.toLocaleString()}`);
        
        if (stats.oldest_data && stats.newest_data) {
            const oldest = new Date(stats.oldest_data);
            const newest = new Date(stats.newest_data);
            const days = Math.round((newest - oldest) / (1000 * 60 * 60 * 24));
            console.log(`Date Range: ${oldest.toISOString().split('T')[0]} to ${newest.toISOString().split('T')[0]} (${days} days)`);
        }
        
        console.log('\n📈 Top Pools by Data Coverage:');
        console.log('Pool                          | Protocol    | Data Points | Vol 30d | FVR   | Signal');
        console.log('─────────────────────────────────────────────────────────────────────────────────────');
        
        pools.forEach(pool => {
            const name = (pool.token_pair || 'Unknown').padEnd(28);
            const protocol = (pool.protocol || 'unknown').padEnd(11);
            const points = String(pool.data_points || 0).padEnd(11);
            const vol = pool.volatility_30d ? (pool.volatility_30d * 100).toFixed(1) + '%' : 'N/A';
            const fvr = pool.fvr ? pool.fvr.toFixed(2) : 'N/A';
            const signal = pool.recommendation || 'N/A';
            
            console.log(`${name} | ${protocol} | ${points} | ${vol.padEnd(7)} | ${fvr.padEnd(5)} | ${signal}`);
        });
        
        // Check if backfill is still running
        const recentData = await analyticsDB.get(`
            SELECT COUNT(*) as recent_count
            FROM price_data
            WHERE created_at > datetime('now', '-1 minute')
        `);
        
        if (recentData.recent_count > 0) {
            console.log(`\n⏳ Data collection in progress... (${recentData.recent_count} points added in last minute)`);
        } else {
            console.log('\n✅ Data collection appears to be complete or paused');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await analyticsDB.close();
    }
}

// Run if called directly
if (require.main === module) {
    monitorProgress().catch(console.error);
}

module.exports = monitorProgress;