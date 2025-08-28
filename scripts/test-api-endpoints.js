#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

// API credentials from .env
const API_KEYS = {
  DEFILLAMA: process.env.DEFILLAMA_API_KEY,
  SOLSCAN: process.env.SOLSCAN_API_KEY,
  COINSTATS: process.env.COINSTATS_API_KEY,
  HELIUS: process.env.HELIUS_API_KEY,
  ZERION: process.env.ZERION_API_KEY
};

console.log('🔍 API Endpoint Testing Started\n');
console.log('Available API Keys:');
Object.entries(API_KEYS).forEach(([name, key]) => {
  console.log(`${name}: ${key ? `${key.substring(0, 8)}...` : 'NOT FOUND'}`);
});
console.log('\n' + '='.repeat(60) + '\n');

// Test Results
const results = {
  working: [],
  failing: [],
  warnings: []
};

// Helper function to test endpoint
async function testEndpoint(name, testFn) {
  try {
    console.log(`📡 Testing ${name}...`);
    const result = await testFn();
    
    if (result.success) {
      console.log(`✅ ${name}: ${result.message}`);
      results.working.push({ name, ...result });
    } else {
      console.log(`⚠️  ${name}: ${result.message}`);
      results.warnings.push({ name, ...result });
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    results.failing.push({ name, error: error.message });
  }
  console.log('');
}

// 1. DeFiLlama API Tests
async function testDeFiLlama() {
  const baseURL = 'https://api.llama.fi';
  const proURL = `https://pro-api.llama.fi/${API_KEYS.DEFILLAMA}`;
  
  // Test free endpoint
  const freeResponse = await axios.get(`${baseURL}/protocols`, { timeout: 10000 });
  const protocolCount = freeResponse.data?.length || 0;
  
  // Test pro endpoint
  let proWorking = false;
  let priceData = null;
  try {
    const proResponse = await axios.get(`${proURL}/coins/prices/current/coingecko:bitcoin,coingecko:ethereum`, { timeout: 10000 });
    proWorking = !!proResponse.data?.coins;
    priceData = proResponse.data?.coins;
  } catch (proError) {
    // Pro might not work, that's ok
  }
  
  return {
    success: true,
    message: `Free API: ${protocolCount} protocols | Pro API: ${proWorking ? 'Working' : 'Limited'}`,
    data: { protocolCount, proWorking, priceData }
  };
}


// 3. Solscan API Test
async function testSolscan() {
  const response = await axios.get('https://public-api.solscan.io/account/So11111111111111111111111111111111111111112', {
    headers: {
      'token': API_KEYS.SOLSCAN
    },
    timeout: 10000
  });
  
  const accountData = response.data?.success && response.data?.data;
  
  return {
    success: !!accountData,
    message: accountData ? `Account data retrieved for SOL token` : 'No account data',
    data: { lamports: accountData?.lamports, executable: accountData?.executable }
  };
}

// 4. CoinStats API Test
async function testCoinStats() {
  const response = await axios.get('https://openapi.coinstats.app/coins/bitcoin', {
    headers: {
      'X-API-KEY': API_KEYS.COINSTATS
    },
    timeout: 10000
  });
  
  const coinData = response.data;
  const price = coinData?.price;
  const change24h = coinData?.priceChange1d;
  
  return {
    success: !!price,
    message: `BTC Price: $${price?.toLocaleString()} (${change24h > 0 ? '+' : ''}${change24h?.toFixed(2)}%)`,
    data: { price, change24h, marketCap: coinData?.marketCap }
  };
}

// 5. Helius RPC Test
async function testHelius() {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  
  const response = await axios.post(rpcUrl, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getSlot'
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  });
  
  const slot = response.data?.result;
  
  return {
    success: !!slot,
    message: `Current Solana slot: ${slot?.toLocaleString()}`,
    data: { slot, rpcUrl: rpcUrl?.substring(0, 50) + '...' }
  };
}

// 6. Zerion API Test
async function testZerion() {
  const testWallet = '0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af';
  
  const response = await axios.get(`https://api.zerion.io/v1/wallets/${testWallet}/positions/`, {
    auth: {
      username: API_KEYS.ZERION,
      password: ''
    },
    params: {
      'filter[positions]': 'no_filter',
      'page[size]': 5
    },
    timeout: 15000
  });
  
  const positions = response.data?.data?.length || 0;
  const totalValue = response.data?.data?.reduce((sum, pos) => sum + (pos.attributes?.value || 0), 0) || 0;
  
  return {
    success: positions > 0,
    message: `${positions} positions found, total value: $${totalValue.toLocaleString()}`,
    data: { positions, totalValue, samplePosition: response.data?.data?.[0]?.attributes }
  };
}

// Run all tests
async function runAllTests() {
  await testEndpoint('DeFiLlama API', testDeFiLlama);
  await testEndpoint('Solscan API', testSolscan);
  await testEndpoint('CoinStats API', testCoinStats);
  await testEndpoint('Helius RPC', testHelius);
  await testEndpoint('Zerion API', testZerion);
  
  // Summary
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Working APIs: ${results.working.length}`);
  console.log(`⚠️  APIs with warnings: ${results.warnings.length}`);
  console.log(`❌ Failing APIs: ${results.failing.length}`);
  
  if (results.working.length > 0) {
    console.log('\n🟢 WORKING APIS:');
    results.working.forEach(api => {
      console.log(`  • ${api.name}: ${api.message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n🟡 APIs WITH WARNINGS:');
    results.warnings.forEach(api => {
      console.log(`  • ${api.name}: ${api.message}`);
    });
  }
  
  if (results.failing.length > 0) {
    console.log('\n🔴 FAILING APIS:');
    results.failing.forEach(api => {
      console.log(`  • ${api.name}: ${api.error}`);
    });
  }
  
  console.log('\n='.repeat(60));
  
  // Data freshness check
  console.log('🕐 DATA FRESHNESS CHECK:');
  const now = new Date();
  console.log(`Test completed at: ${now.toLocaleString()}`);
  
  // Check if any working API returned stale data
  const freshnessConcerns = [];
  results.working.forEach(api => {
    if (api.name === 'CoinStats API' && api.data?.price) {
      // Check if price is reasonable for current market
      const btcPrice = api.data.price;
      if (btcPrice < 30000 || btcPrice > 200000) {
        freshnessConcerns.push(`${api.name}: BTC price ${btcPrice} seems unrealistic`);
      }
    }
  });
  
  if (freshnessConcerns.length > 0) {
    console.log('⚠️  Potential data freshness issues:');
    freshnessConcerns.forEach(concern => console.log(`  • ${concern}`));
  } else {
    console.log('✅ All price data appears current and realistic');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  if (results.failing.length > 0) {
    console.log('  • Check failing API credentials and endpoints');
  }
  if (results.working.length >= 4) {
    console.log('  • Good API coverage for multi-source data validation');
  }
  console.log('  • Consider implementing fallback logic for critical endpoints');
  console.log('  • Set up monitoring for API response times and data quality');
  
  return {
    working: results.working.length,
    warnings: results.warnings.length,
    failing: results.failing.length,
    totalTested: results.working.length + results.warnings.length + results.failing.length
  };
}

// Run the test suite
runAllTests()
  .then(summary => {
    console.log(`\n🎯 Testing completed: ${summary.working}/${summary.totalTested} APIs working properly`);
    process.exit(summary.failing > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });