#!/usr/bin/env node
// Display top pools with comprehensive analytics metrics
// Sorted by different criteria to help CLM strategy selection

require('dotenv').config();
const analyticsDB = require('../utils/database');

global.analyticsDB = analyticsDB;

class TopPoolsAnalyzer {
    async run() {
        console.log('🏆 Top Pools Analysis - CLM Strategy Selection');
        console.log('📊 Based on FVR, volatility, and risk metrics from math.md formulas\n');

        try {
            await analyticsDB.initialize();

            // 1. Most Attractive FVR Pools (>1.0)
            console.log('🎯 Most Attractive Pools (FVR > 1.0):');
            console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
            const attractivePools = await this.getTopPoolsByFVR('attractive');
            this.displayPoolTable(attractivePools);

            // 2. Best Low-Risk Pools (Vol < 20%)
            console.log('\n🛡️  Best Low-Risk Pools (Volatility < 20%):');
            console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
            const lowRiskPools = await this.getLowRiskPools();
            this.displayPoolTable(lowRiskPools);

            // 3. High Data Quality Pools (180+ days)
            console.log('\n📅 High Data Quality Pools (180+ days historical):');
            console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
            const qualityPools = await this.getHighDataQualityPools();
            this.displayPoolTable(qualityPools);

            // 4. CLM-Ready Summary
            console.log('\n📈 CLM Strategy Recommendations:');
            this.displayCLMSummary();

        } catch (error) {
            console.error('❌ Analysis failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async getTopPoolsByFVR(recommendation = 'attractive') {
        return await analyticsDB.all(`
            SELECT 
                pa.token_pair,
                pa.network,
                p.protocol,
                pa.fvr,
                pa.volatility_30d,
                pa.apy_base,
                pa.il_risk_score,
                pa.tvl_usd,
                pa.volume_24h,
                pa.data_points_count,
                pa.recommendation
            FROM pool_analytics pa
            JOIN pools p ON pa.pool_address = p.pool_address
            WHERE pa.recommendation = ? 
            AND pa.fvr IS NOT NULL 
            AND pa.tvl_usd > 100000
            ORDER BY pa.fvr DESC
            LIMIT 15
        `, [recommendation]);
    }

    async getLowRiskPools() {
        return await analyticsDB.all(`
            SELECT 
                pa.token_pair,
                pa.network,
                p.protocol,
                pa.fvr,
                pa.volatility_30d,
                pa.apy_base,
                pa.il_risk_score,
                pa.tvl_usd,
                pa.volume_24h,
                pa.data_points_count,
                pa.recommendation
            FROM pool_analytics pa
            JOIN pools p ON pa.pool_address = p.pool_address
            WHERE pa.volatility_30d < 0.20
            AND pa.fvr IS NOT NULL
            AND pa.tvl_usd > 100000
            ORDER BY pa.fvr DESC
            LIMIT 15
        `);
    }

    async getHighDataQualityPools() {
        return await analyticsDB.all(`
            SELECT 
                pa.token_pair,
                pa.network,
                p.protocol,
                pa.fvr,
                pa.volatility_30d,
                pa.apy_base,
                pa.il_risk_score,
                pa.tvl_usd,
                pa.volume_24h,
                pa.data_points_count,
                pa.recommendation
            FROM pool_analytics pa
            JOIN pools p ON pa.pool_address = p.pool_address
            WHERE pa.data_points_count >= 180
            AND pa.fvr IS NOT NULL
            AND pa.tvl_usd > 100000
            ORDER BY pa.fvr DESC
            LIMIT 15
        `);
    }

    displayPoolTable(pools) {
        if (pools.length === 0) {
            console.log('   No pools found matching criteria');
            return;
        }

        console.log('Pool                     | Network  | Protocol      | FVR    | Vol30d | APY    | Risk | TVL($M) | Signal');
        console.log('────────────────────────────────────────────────────────────────────────────────────────────────────────');

        pools.forEach((pool, i) => {
            const rank = `${i + 1}.`.padEnd(3);
            const name = (pool.token_pair || 'Unknown').substring(0, 22).padEnd(23);
            const network = (pool.network || '').substring(0, 8).padEnd(8);
            const protocol = (pool.protocol || '').substring(0, 13).padEnd(13);
            const fvr = pool.fvr ? pool.fvr.toFixed(2).padStart(6) : 'N/A'.padStart(6);
            const vol = pool.volatility_30d ? `${(pool.volatility_30d * 100).toFixed(1)}%`.padStart(6) : 'N/A'.padStart(6);
            const apy = pool.apy_base ? `${(pool.apy_base * 100).toFixed(1)}%`.padStart(6) : 'N/A'.padStart(6);
            const risk = pool.il_risk_score ? `${pool.il_risk_score}/10`.padStart(4) : 'N/A'.padStart(4);
            const tvl = pool.tvl_usd ? `${(pool.tvl_usd / 1000000).toFixed(1)}M`.padStart(7) : 'N/A'.padStart(7);
            const signal = this.getSignalEmoji(pool.recommendation);

            console.log(`${name} | ${network} | ${protocol} | ${fvr} | ${vol} | ${apy} | ${risk} | ${tvl} | ${signal}`);
        });
    }

    getSignalEmoji(recommendation) {
        switch (recommendation) {
            case 'attractive': return '🟢 Strong';
            case 'fair': return '🟡 Fair';
            case 'overpriced': return '🔴 Weak';
            default: return '⚪ Unknown';
        }
    }

    async displayCLMSummary() {
        // Get summary statistics
        const stats = await analyticsDB.get(`
            SELECT 
                COUNT(*) as total_pools,
                COUNT(CASE WHEN recommendation = 'attractive' THEN 1 END) as attractive_pools,
                COUNT(CASE WHEN recommendation = 'fair' THEN 1 END) as fair_pools,
                COUNT(CASE WHEN recommendation = 'overpriced' THEN 1 END) as overpriced_pools,
                COUNT(CASE WHEN volatility_30d < 0.20 THEN 1 END) as low_risk_pools,
                COUNT(CASE WHEN data_points_count >= 180 THEN 1 END) as quality_data_pools,
                AVG(fvr) as avg_fvr,
                AVG(volatility_30d) as avg_volatility
            FROM pool_analytics 
            WHERE fvr IS NOT NULL
        `);

        console.log('\n📊 Portfolio Analysis Summary:');
        console.log('─────────────────────────────────────────────────────────────────');
        console.log(`   Total analyzed pools: ${stats.total_pools}`);
        console.log(`   🟢 Attractive signals (FVR > 1.0): ${stats.attractive_pools} pools`);
        console.log(`   🟡 Fair signals (FVR 0.6-1.0): ${stats.fair_pools} pools`);
        console.log(`   🔴 Overpriced signals (FVR < 0.6): ${stats.overpriced_pools} pools`);
        console.log(`   🛡️  Low-risk pools (<20% vol): ${stats.low_risk_pools} pools`);
        console.log(`   📅 Quality data pools (180+ days): ${stats.quality_data_pools} pools`);
        
        if (stats.avg_fvr && stats.avg_volatility) {
            console.log(`   📈 Average FVR: ${stats.avg_fvr.toFixed(2)}`);
            console.log(`   📊 Average 30d volatility: ${(stats.avg_volatility * 100).toFixed(1)}%`);
        }

        console.log('\n🎯 Key Insights:');
        console.log('   • Focus on pools with FVR > 1.0 for best risk-adjusted returns');
        console.log('   • Prioritize pools with volatility < 20% for stable yields');
        console.log('   • Use pools with 180+ days data for backtesting strategies');
        console.log('   • Monitor IL risk scores: 1-3 (low risk), 4-6 (medium), 7-10 (high)');
    }
}

// Command line interface
async function main() {
    const analyzer = new TopPoolsAnalyzer();
    await analyzer.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TopPoolsAnalyzer;