#!/usr/bin/env node
require('dotenv').config();

const { Connection, PublicKey } = require('@solana/web3.js');

// Your position mints
const POSITION_MINTS = [
  'J9boQJgr4xefqoBJcYCNtfRXpiLwje5DW3fksH4bGkbX',  // cbBTC/SOL - Expected $190.27
  '3P832skDFHaohd2kmnJh36nKTHjpW1V6Sr8mGH6PahDZ',  // WBTC/SOL - Expected $119.24
  'BGzAwP84gsVfB3p2miNb5spC59nX6Q2UfMyPg3RX4DKa'   // cbBTC/USDC - Expected $76.88
];

const ORCA_WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

async function investigatePendingYield() {
  console.log('🔍 INVESTIGATING PENDING YIELD DATA SOURCES\n');
  
  const connection = new Connection(process.env.HELIUS_RPC_URL, 'confirmed');
  
  for (let i = 0; i < POSITION_MINTS.length; i++) {
    const mintAddress = POSITION_MINTS[i];
    console.log(`📍 Position ${i + 1}: ${mintAddress.slice(0, 8)}...`);
    
    try {
      // Get position PDA
      const [positionPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), new PublicKey(mintAddress).toBuffer()],
        ORCA_WHIRLPOOL_PROGRAM_ID
      );
      
      console.log(`   Position PDA: ${positionPDA.toString()}`);
      
      // Get position account data
      const positionAccount = await connection.getAccountInfo(positionPDA);
      if (positionAccount) {
        console.log(`   ✅ Position account found (${positionAccount.data.length} bytes)`);
        
        // Parse fee data from position account
        const data = positionAccount.data;
        
        // Fee owed offsets (based on Orca position structure)
        const feeOwedAOffset = 128;
        const feeOwedBOffset = 136;
        
        // Read fee owed (64-bit numbers, little endian)
        const feeOwedA = data.readBigUInt64LE(feeOwedAOffset);
        const feeOwedB = data.readBigUInt64LE(feeOwedBOffset);
        
        console.log(`   💰 Raw Fee Data:`);
        console.log(`      Fee Owed A: ${feeOwedA.toString()}`);
        console.log(`      Fee Owed B: ${feeOwedB.toString()}`);
        
        // Get whirlpool address to determine tokens
        const whirlpoolOffset = 8;
        const whirlpoolBytes = data.slice(whirlpoolOffset, whirlpoolOffset + 32);
        const whirlpool = new PublicKey(whirlpoolBytes);
        
        console.log(`   🏊‍♀️ Whirlpool: ${whirlpool.toString()}`);
        
        // Get whirlpool data for token info
        const whirlpoolAccount = await connection.getAccountInfo(whirlpool);
        if (whirlpoolAccount) {
          const poolData = whirlpoolAccount.data;
          
          const tokenMintAOffset = 101;
          const tokenMintBOffset = 133;
          
          const tokenMintA = new PublicKey(poolData.slice(tokenMintAOffset, tokenMintAOffset + 32));
          const tokenMintB = new PublicKey(poolData.slice(tokenMintBOffset, tokenMintBOffset + 32));
          
          console.log(`   🪙 Token A: ${tokenMintA.toString()}`);
          console.log(`   🪙 Token B: ${tokenMintB.toString()}`);
          
          // Convert fees to human readable (assuming decimals)
          // This is where we need token decimal information
          const tokenADecimals = getTokenDecimals(tokenMintA.toString());
          const tokenBDecimals = getTokenDecimals(tokenMintB.toString());
          
          const feeOwedAHuman = Number(feeOwedA) / Math.pow(10, tokenADecimals);
          const feeOwedBHuman = Number(feeOwedB) / Math.pow(10, tokenBDecimals);
          
          console.log(`   📊 Human-Readable Fees:`);
          console.log(`      Fee A: ${feeOwedAHuman.toFixed(8)} (${getTokenSymbol(tokenMintA.toString())})`);
          console.log(`      Fee B: ${feeOwedBHuman.toFixed(8)} (${getTokenSymbol(tokenMintB.toString())})`);
          
          // TODO: Convert to USD using token prices
          console.log(`   💵 USD Value: REQUIRES TOKEN PRICE LOOKUP`);
          console.log(`      (This is where we'd need DeFiLlama/CoinGecko prices)`);
        }
        
      } else {
        console.log(`   ❌ Position account not found`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🔍 FINDINGS:');
  console.log('1. Position accounts contain raw fee data (feeOwedA, feeOwedB)');
  console.log('2. Need token decimals and prices to convert to USD');
  console.log('3. Current hardcoded values ($190.27, $119.24, $76.88) are NOT from API');
  console.log('4. Real pending yield requires:');
  console.log('   - Raw fees from position accounts ✅');
  console.log('   - Token decimals for each token ❓');
  console.log('   - Current token prices (DeFiLlama/CoinGecko) ❓');
  console.log('   - Conversion formula: (feeOwed / 10^decimals) * tokenPrice');
  
  console.log('\n⚠️  CURRENT ISSUE:');
  console.log('   The $190.27, $119.24, $76.88 values are HARDCODED');
  console.log('   They are NOT fetched from any real API or on-chain source');
  console.log('   This violates the "no mock data" principle');
}

function getTokenDecimals(mintAddress) {
  const decimalsMap = {
    'So11111111111111111111111111111111111111112': 9, // SOL
    'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij': 8, // cbBTC
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 8, // WBTC
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  };
  return decimalsMap[mintAddress] || 9;
}

function getTokenSymbol(mintAddress) {
  const symbolMap = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij': 'cbBTC',
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'WBTC',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4YGGkZwyTDt1v': 'USDC',
  };
  return symbolMap[mintAddress] || 'Unknown';
}

investigatePendingYield().catch(console.error);