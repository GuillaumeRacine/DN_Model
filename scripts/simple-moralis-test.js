require('dotenv').config();

// Simple test for Moralis API connectivity
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

async function testMoralisConnection() {
  console.log('🧪 Testing Moralis API Connection\n');
  
  if (!MORALIS_API_KEY) {
    console.error('❌ MORALIS_API_KEY not found in .env');
    return;
  }

  console.log('✅ Moralis API Key found');
  console.log(`🔑 Key: ${MORALIS_API_KEY.slice(0, 20)}...`);

  // Test 1: Base Chain - Token balances
  console.log('\n🔍 Test 1: Base Chain Token Balances');
  const baseWallet = '0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af';
  const baseChainId = '0x2105';
  
  try {
    const response = await fetch(
      `${BASE_URL}/${baseWallet}/erc20?chain=${baseChainId}&exclude_spam=true`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokens = data.result || [];
    
    console.log(`✅ Base Chain: Found ${tokens.length} tokens`);
    
    if (tokens.length > 0) {
      console.log('📝 Sample tokens:');
      tokens.slice(0, 3).forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.symbol} (${token.name}) - Balance: ${token.balance_formatted}`);
      });
    }

  } catch (error) {
    console.error('❌ Base Chain test failed:', error.message);
  }

  // Test 2: Solana - Token balances  
  console.log('\n☀️ Test 2: Solana Token Balances');
  const solanaWallet = 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k';
  
  try {
    const response = await fetch(
      `${BASE_URL}/account/mainnet/${solanaWallet}/tokens`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tokens = data.tokens || [];
    
    console.log(`✅ Solana: Found ${tokens.length} tokens`);
    
    if (tokens.length > 0) {
      console.log('📝 Sample tokens:');
      tokens.slice(0, 3).forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.symbol} (${token.name}) - Balance: ${token.amount}`);
      });
    }

  } catch (error) {
    console.error('❌ Solana test failed:', error.message);
  }

  console.log('\n✅ Moralis API Test Complete!');
}

testMoralisConnection().catch(console.error);