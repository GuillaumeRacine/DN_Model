#!/usr/bin/env node
// Test script to validate Moralis API integration

import { moralisAPI, moralisHelpers, MORALIS_CHAINS } from '../lib/moralis-api.ts';

// Test configuration
const TEST_CONFIG = {
  EVM_WALLET: '0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af',
  SOLANA_WALLET: 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k',
  TEST_CHAINS: [
    { name: 'Base', id: MORALIS_CHAINS.BASE },
    { name: 'Ethereum', id: MORALIS_CHAINS.ETHEREUM },
  ]
};

console.log('🧪 Testing Moralis API Integration for DN_Model\n');

async function testMoralisAPI() {
  console.log('📋 Test Configuration:');
  console.log(`  EVM Wallet: ${TEST_CONFIG.EVM_WALLET}`);
  console.log(`  Solana Wallet: ${TEST_CONFIG.SOLANA_WALLET}`);
  console.log(`  Moralis API Key: ${process.env.MORALIS_API_KEY ? '✅ Set' : '❌ Missing'}\n`);

  if (!process.env.MORALIS_API_KEY) {
    console.error('❌ MORALIS_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Test 1: EVM Token Balances
  console.log('🔍 Test 1: EVM Token Balances');
  for (const chain of TEST_CONFIG.TEST_CHAINS) {
    try {
      console.log(`  Testing ${chain.name} (${chain.id})...`);
      const tokens = await moralisAPI.getWalletTokenBalances(TEST_CONFIG.EVM_WALLET, chain.id);
      console.log(`  ✅ Found ${tokens.length} tokens on ${chain.name}`);
      
      // Filter for potential LP tokens
      const lpTokens = moralisAPI.filterLPTokens(tokens);
      console.log(`  🔍 Potential LP tokens: ${lpTokens.length}`);
      
      if (lpTokens.length > 0) {
        console.log('  📝 LP Token Examples:');
        lpTokens.slice(0, 3).forEach((token, index) => {
          console.log(`    ${index + 1}. ${token.symbol} (${token.name}) - Balance: ${token.balance_formatted}`);
        });
      }
    } catch (error) {
      console.error(`  ❌ Error testing ${chain.name}:`, error.message);
    }
  }

  console.log();

  // Test 2: EVM NFT Positions (LP NFTs like Uniswap V3)
  console.log('🎨 Test 2: EVM NFT Positions');
  for (const chain of TEST_CONFIG.TEST_CHAINS) {
    try {
      console.log(`  Testing ${chain.name} NFTs...`);
      const nfts = await moralisAPI.getWalletNFTs(TEST_CONFIG.EVM_WALLET, chain.id);
      console.log(`  ✅ Found ${nfts.length} NFTs on ${chain.name}`);
      
      // Filter for potential LP NFTs
      const lpNFTs = moralisAPI.filterLPNFTs(nfts);
      console.log(`  🔍 Potential LP NFTs: ${lpNFTs.length}`);
      
      if (lpNFTs.length > 0) {
        console.log('  📝 LP NFT Examples:');
        lpNFTs.slice(0, 3).forEach((nft, index) => {
          console.log(`    ${index + 1}. ${nft.name} (${nft.symbol}) - Token ID: ${nft.token_id}`);
        });
      }
    } catch (error) {
      console.error(`  ❌ Error testing ${chain.name} NFTs:`, error.message);
    }
  }

  console.log();

  // Test 3: Solana Token Balances
  console.log('☀️ Test 3: Solana Token Balances');
  try {
    console.log(`  Testing Solana wallet: ${TEST_CONFIG.SOLANA_WALLET}...`);
    const solanaTokens = await moralisAPI.getSolanaTokenBalances(TEST_CONFIG.SOLANA_WALLET);
    console.log(`  ✅ Found ${solanaTokens.length} tokens on Solana`);
    
    if (solanaTokens.length > 0) {
      console.log('  📝 Solana Token Examples:');
      solanaTokens.slice(0, 5).forEach((token, index) => {
        console.log(`    ${index + 1}. ${token.symbol} (${token.name}) - Balance: ${token.amount}`);
      });
    }
  } catch (error) {
    console.error('  ❌ Error testing Solana tokens:', error.message);
  }

  console.log();

  // Test 4: Comprehensive LP Position Scan
  console.log('🔍 Test 4: Comprehensive LP Position Scan');
  try {
    console.log('  Running comprehensive LP scan for EVM chains...');
    const evmResults = await moralisHelpers.getAllLPPositions(TEST_CONFIG.EVM_WALLET);
    
    console.log('  📊 EVM Scan Results:');
    console.log(`    Total LP Tokens: ${evmResults.summary.totalLPTokens}`);
    console.log(`    Total NFT Positions: ${evmResults.summary.totalNFTPositions}`);
    console.log(`    Total DeFi Positions: ${evmResults.summary.totalDeFiPositions}`);
    console.log(`    Chains Covered: ${evmResults.summary.chainsCovered.join(', ')}`);

    console.log();
    console.log('  Running Solana LP scan...');
    const solanaResults = await moralisHelpers.getSolanaLPPositions(TEST_CONFIG.SOLANA_WALLET);
    
    console.log('  📊 Solana Scan Results:');
    console.log(`    Total Tokens: ${solanaResults.totalTokens}`);
    console.log(`    Potential LP Tokens: ${solanaResults.potentialLPTokens}`);

  } catch (error) {
    console.error('  ❌ Error in comprehensive scan:', error.message);
  }

  console.log();
  console.log('✅ Moralis API Integration Test Complete!');
  console.log('🚀 Ready to discover LP positions across multiple chains.');
}

// Handle module resolution for Next.js environment
async function runTest() {
  try {
    if (typeof window === 'undefined') {
      // Load environment variables
      require('dotenv').config();
      await testMoralisAPI();
    } else {
      console.log('❌ This test script should be run in Node.js environment');
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}

export { testMoralisAPI };