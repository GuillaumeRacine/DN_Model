#!/usr/bin/env node
require('dotenv').config();

const { Connection, PublicKey } = require('@solana/web3.js');

// Known accurate data from Orca app
const EXPECTED_ORCA_DATA = {
  'J9boQJgr4xefqoBJcYCNtfRXpiLwje5DW3fksH4bGkbX': {
    pair: 'cbBTC/SOL',
    balance: 46341.02,
    yield: 190.27,
    apy: 59.877,
    currentPrice: 532.31,
    rangeLower: 455.32,
    rangeUpper: 682.51,
    inRange: true,
    status: 'IN RANGE'
  },
  '3P832skDFHaohd2kmnJh36nKTHjpW1V6Sr8mGH6PahDZ': {
    pair: 'WBTC/SOL', 
    balance: 41006.14,
    yield: 119.24,
    apy: 39.935,
    currentPrice: 532.54,
    rangeLower: 427.09,
    rangeUpper: 712.07,
    inRange: true,
    status: 'IN RANGE'
  },
  'BGzAwP84gsVfB3p2miNb5spC59nX6Q2UfMyPg3RX4DKa': {
    pair: 'cbBTC/USDC',
    balance: 17574.06,
    yield: 76.88,
    apy: 43.249,
    currentPrice: 112100,
    rangeLower: 106400,
    rangeUpper: 121600,
    inRange: true,
    status: 'IN RANGE'
  }
};

const WALLET_ADDRESS = 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k';
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

async function compareDataSources() {
  console.log('🔍 COMPARING DATA SOURCES TO ORCA APP TRUTH\n');
  console.log('Expected data from Orca app:');
  Object.entries(EXPECTED_ORCA_DATA).forEach(([mint, data]) => {
    console.log(`  ${data.pair}: $${data.balance.toLocaleString()} (${data.status})`);
  });
  console.log('\n' + '='.repeat(80) + '\n');

  // Test 1: Helius RPC
  console.log('🔗 TEST 1: HELIUS RPC ANALYSIS');
  console.log('Testing if Helius can provide accurate position data...\n');
  
  try {
    const connection = new Connection(process.env.HELIUS_RPC_URL, 'confirmed');
    console.log('✅ Connected to Helius RPC');
    
    // Test getting wallet's token accounts
    const walletPubkey = new PublicKey(WALLET_ADDRESS);
    
    // Get all token accounts (both Token and Token2022 programs)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey, 
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') }
    );
    
    console.log(`📊 Helius Results:`);
    console.log(`   Regular Token Accounts: ${tokenAccounts.value.length}`);
    console.log(`   Token2022 Accounts: ${token2022Accounts.value.length}`);
    
    // Look for our known position NFTs
    const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];
    const positionNFTs = [];
    
    for (const account of allAccounts) {
      if (account.account.data?.parsed?.info) {
        const info = account.account.data.parsed.info;
        if (info.tokenAmount?.uiAmount === 1 && info.tokenAmount?.decimals === 0) {
          // This is an NFT
          const mintAddress = info.mint;
          if (EXPECTED_ORCA_DATA[mintAddress]) {
            positionNFTs.push({
              tokenAccount: account.pubkey.toString(),
              mint: mintAddress,
              expected: EXPECTED_ORCA_DATA[mintAddress]
            });
            console.log(`   🎯 Found Position NFT: ${EXPECTED_ORCA_DATA[mintAddress].pair}`);
            console.log(`      Token Account: ${account.pubkey.toString()}`);
            console.log(`      Mint: ${mintAddress}`);
          }
        }
      }
    }
    
    console.log(`\n   ✅ Found ${positionNFTs.length}/3 expected position NFTs via Helius`);
    
    // Test Helius DAS (Digital Asset Standard) API
    console.log(`\n🎨 Testing Helius DAS API for NFT metadata...`);
    
    for (const nft of positionNFTs) {
      try {
        const response = await fetch(process.env.HELIUS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'helius-test',
            method: 'getAsset',
            params: { id: nft.mint }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.result) {
            console.log(`   ✅ DAS API found metadata for ${nft.expected.pair}`);
            console.log(`      Collection: ${result.result.grouping?.[0]?.group_value || 'Unknown'}`);
            console.log(`      Name: ${result.result.content?.metadata?.name || 'Unknown'}`);
            
            // Check for position-specific attributes
            if (result.result.content?.metadata?.attributes) {
              console.log(`      Attributes: ${result.result.content.metadata.attributes.length} found`);
            }
          }
        }
      } catch (dasError) {
        console.log(`   ❌ DAS API failed for ${nft.expected.pair}: ${dasError.message}`);
      }
    }
    
  } catch (heliusError) {
    console.log(`❌ Helius RPC failed: ${heliusError.message}`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');

  // Test 2: Moralis API
  console.log('🌐 TEST 2: MORALIS API ANALYSIS');
  console.log('Testing if Moralis can detect Solana positions...\n');
  
  if (!MORALIS_API_KEY) {
    console.log('❌ MORALIS_API_KEY not found');
    return;
  }
  
  try {
    // Test Solana endpoint
    const moralisHeaders = {
      'Accept': 'application/json',
      'X-API-Key': MORALIS_API_KEY,
    };
    
    // Try different Moralis endpoints for Solana
    const endpoints = [
      `https://deep-index.moralis.io/api/v2.2/account/mainnet/${WALLET_ADDRESS}/tokens`,
      `https://solana-gateway.moralis.io/account/mainnet/${WALLET_ADDRESS}/tokens`,
      `https://deep-index.moralis.io/api/v2/${WALLET_ADDRESS}/nft?chain=solana&format=decimal`,
    ];
    
    for (let i = 0; i < endpoints.length; i++) {
      console.log(`📡 Testing Moralis endpoint ${i + 1}...`);
      
      try {
        const response = await fetch(endpoints[i], { headers: moralisHeaders });
        console.log(`   Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ Response received`);
          console.log(`   Data keys: ${Object.keys(data).join(', ')}`);
          
          // Look for tokens or result arrays
          const tokens = data.tokens || data.result || [];
          console.log(`   Tokens found: ${tokens.length}`);
          
          if (tokens.length > 0) {
            console.log(`   Sample token:`, {
              mint: tokens[0].mint || tokens[0].token_address,
              symbol: tokens[0].symbol,
              amount: tokens[0].amount || tokens[0].balance
            });
          }
        } else {
          console.log(`   ❌ Failed: ${response.status}`);
        }
      } catch (endpointError) {
        console.log(`   ❌ Error: ${endpointError.message}`);
      }
    }
    
  } catch (moralisError) {
    console.log(`❌ Moralis test failed: ${moralisError.message}`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');

  // Test 3: Direct Orca SDK
  console.log('🏊‍♂️ TEST 3: ORCA SDK DIRECT ANALYSIS');
  console.log('Testing Orca SDK with proper position lookup...\n');
  
  try {
    // We know our position mint addresses work, let's test the actual Orca SDK
    const { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil } = require('@orca-so/whirlpools-sdk');
    
    const connection = new Connection(process.env.HELIUS_RPC_URL, 'confirmed');
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async () => { throw new Error('Read-only'); },
      signAllTransactions: async () => { throw new Error('Read-only'); },
    };
    
    const ctx = WhirlpoolContext.from(connection, dummyWallet, ORCA_WHIRLPOOL_PROGRAM_ID);
    const client = buildWhirlpoolClient(ctx);
    
    console.log('✅ Orca SDK initialized');
    
    for (const [mintAddress, expectedData] of Object.entries(EXPECTED_ORCA_DATA)) {
      console.log(`\n🔍 Testing position: ${expectedData.pair}`);
      
      try {
        const mintPubkey = new PublicKey(mintAddress);
        
        // Use the proper method to get position PDA
        const [positionPDA, bump] = PDAUtil.getPosition(ORCA_WHIRLPOOL_PROGRAM_ID, mintPubkey);
        console.log(`   Position PDA: ${positionPDA.toString()}`);
        console.log(`   PDA Bump: ${bump}`);
        
        // Try to get position data
        const position = await client.getPosition(positionPDA);
        
        if (position) {
          console.log(`   ✅ Position loaded successfully!`);
          const positionData = position.getData();
          
          console.log(`   Liquidity: ${positionData.liquidity.toString()}`);
          console.log(`   Tick Lower: ${positionData.tickLowerIndex}`);
          console.log(`   Tick Upper: ${positionData.tickUpperIndex}`);
          console.log(`   Whirlpool: ${positionData.whirlpool.toString()}`);
          
          // Get whirlpool data for current price
          const whirlpool = await client.getPool(positionData.whirlpool);
          if (whirlpool) {
            const poolData = whirlpool.getData();
            console.log(`   Current Tick: ${poolData.tickCurrentIndex}`);
            console.log(`   Sqrt Price: ${poolData.sqrtPrice.toString()}`);
            
            // Check range status
            const inRange = poolData.tickCurrentIndex >= positionData.tickLowerIndex && 
                           poolData.tickCurrentIndex < positionData.tickUpperIndex;
            console.log(`   SDK Range Status: ${inRange ? 'IN RANGE' : 'OUT OF RANGE'}`);
            console.log(`   Expected Status: ${expectedData.status}`);
            
            if (inRange !== expectedData.inRange) {
              console.log(`   ⚠️  MISMATCH: SDK says ${inRange ? 'IN' : 'OUT'}, Orca app says ${expectedData.status}`);
            } else {
              console.log(`   ✅ Range status matches Orca app`);
            }
          }
        } else {
          console.log(`   ❌ Could not load position data`);
        }
        
      } catch (posError) {
        console.log(`   ❌ Position test failed: ${posError.message}`);
      }
    }
    
  } catch (orcaError) {
    console.log(`❌ Orca SDK test failed: ${orcaError.message}`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');

  // Summary
  console.log('📋 ANALYSIS SUMMARY:');
  console.log('Expected from Orca App:');
  console.log(`   Total Portfolio Value: $${Object.values(EXPECTED_ORCA_DATA).reduce((sum, pos) => sum + pos.balance, 0).toLocaleString()}`);
  console.log(`   All Positions: IN RANGE (earning fees)`);
  console.log(`   Average APY: ${(Object.values(EXPECTED_ORCA_DATA).reduce((sum, pos) => sum + pos.apy, 0) / 3).toFixed(1)}%`);
  console.log('\nNext steps:');
  console.log('   1. Identify which API source provides most accurate data');
  console.log('   2. Fix tick-to-price conversion issues');
  console.log('   3. Implement proper USD value calculation');
  console.log('   4. Update dashboard with working data source');
}

compareDataSources().catch(console.error);