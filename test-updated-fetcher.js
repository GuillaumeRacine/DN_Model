#!/usr/bin/env node

// Quick test to see if we can call the TypeScript fetcher from Node.js
async function testTypeScriptFetcher() {
  console.log('🧪 TESTING DIRECT TYPESCRIPT FETCHER ACCESS\n');
  
  try {
    // Try to dynamically import the ES module
    const { accurateOrcaFetcher } = await import('./lib/accurate-orca-fetcher.js');
    
    console.log('✅ Successfully imported accurateOrcaFetcher');
    
    const positions = await accurateOrcaFetcher.getAccuratePositions();
    
    console.log(`📊 Found ${positions.length} positions:`);
    
    positions.forEach((pos, index) => {
      console.log(`\n${index + 1}. ${pos.tokenPair}`);
      console.log(`   TVL USD: $${pos.tvlUsd}`);
      console.log(`   APR: ${pos.apr}%`);
      console.log(`   In Range: ${pos.inRange}`);
      console.log(`   Data Source: ${pos.dataSource}`);
    });
    
    if (positions.length === 0) {
      console.log('\n🔴 NO POSITIONS FOUND - This explains the dashboard issue!');
    } else {
      console.log('\n✅ Positions found - Dashboard should be working!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Cannot resolve')) {
      console.log('\n💡 The TypeScript module needs to be compiled first.');
      console.log('The dashboard should work since Next.js compiles TypeScript automatically.');
    }
  }
}

testTypeScriptFetcher().catch(console.error);