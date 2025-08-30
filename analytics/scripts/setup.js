#!/usr/bin/env node
// Setup script for CLM Analytics system
require('dotenv').config();

const path = require('path');
const analyticsDB = require('../utils/database');

async function setupAnalytics() {
    console.log('🚀 CLM Analytics Setup Starting...\n');
    
    try {
        // 1. Initialize database
        console.log('📊 Step 1: Initializing database...');
        await analyticsDB.initialize();
        
        // 2. Check table counts
        console.log('\n📋 Step 2: Checking database structure...');
        const counts = await analyticsDB.getTableCounts();
        console.log('Table counts:', counts);
        
        // 3. Verify API connections
        console.log('\n🌐 Step 3: Testing API connections...');
        
        const { geckoTerminalClient, defiLlamaClient } = require('../utils/api-client');
        
        try {
            const networks = await geckoTerminalClient.getNetworks();
            console.log(`✅ GeckoTerminal: ${networks.data?.length || 0} networks available`);
        } catch (error) {
            console.log('❌ GeckoTerminal API error:', error.message);
        }
        
        try {
            const pools = await defiLlamaClient.getTopPoolsByTVL(10000000, 5); // Top 5 pools with $10M+ TVL
            console.log(`✅ DeFiLlama: ${pools.length} top pools fetched`);
        } catch (error) {
            console.log('❌ DeFiLlama API error:', error.message);
        }
        
        // 4. Show available commands
        console.log('\n🎯 Setup complete! Available commands:');
        console.log('   node analytics/scripts/backfill.js     - Collect 6 months of historical data');
        console.log('   node analytics/collectors/hourly-collector.js - Run hourly data collection');
        console.log('   node analytics/scripts/validate.js    - Validate data quality');
        
        console.log('\n📁 Analytics Database Location:', analyticsDB.dbPath);
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    } finally {
        await analyticsDB.close();
    }
}

if (require.main === module) {
    setupAnalytics().catch(console.error);
}

module.exports = setupAnalytics;