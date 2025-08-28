#!/usr/bin/env node
require('dotenv').config();

const { Connection, PublicKey } = require('@solana/web3.js');

// Your NFT mints discovered from the analysis
const ORCA_POSITION_MINTS = [
  'J9boQJgr4xefqoBJcYCNtfRXpiLwje5DW3fksH4bGkbX',  // Position 1
  '3P832skDFHaohd2kmnJh36nKTHjpW1V6Sr8mGH6PahDZ',  // Position 2  
  'BGzAwP84gsVfB3p2miNb5spC59nX6Q2UfMyPg3RX4DKa'   // Position 3
];

const ORCA_WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

async function lookupOrcaPositions() {
  console.log('🔍 Looking up Orca Position Details by Mint Address\n');
  
  const connection = new Connection(process.env.HELIUS_RPC_URL, 'confirmed');
  
  for (let i = 0; i < ORCA_POSITION_MINTS.length; i++) {
    const mintAddress = ORCA_POSITION_MINTS[i];
    console.log(`🏊‍♂️ Position ${i + 1} - Mint: ${mintAddress}`);
    
    try {
      // Method 1: Calculate position PDA manually
      const mintPubkey = new PublicKey(mintAddress);
      
      // Orca position PDA derivation: ["position", mint]
      const [positionPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), mintPubkey.toBuffer()],
        ORCA_WHIRLPOOL_PROGRAM_ID
      );
      
      console.log(`   Position PDA: ${positionPDA.toString()}`);
      
      // Get the position account
      const positionAccount = await connection.getAccountInfo(positionPDA);
      if (positionAccount) {
        console.log(`   ✅ Position account found!`);
        console.log(`   Account size: ${positionAccount.data.length} bytes`);
        console.log(`   Owner: ${positionAccount.owner.toString()}`);
        
        // Parse position data (basic structure)
        if (positionAccount.data.length >= 216) { // Expected size for Orca position
          const data = positionAccount.data;
          
          // Extract key position data (offsets based on Orca position structure)
          const whirlpoolOffset = 8;  // Skip discriminator
          const positionMintOffset = 40;
          const liquidityOffset = 72;
          const tickLowerOffset = 88;
          const tickUpperOffset = 92;
          const feeGrowthCheckpointAOffset = 96;
          const feeGrowthCheckpointBOffset = 112;
          const feeOwedAOffset = 128;
          const feeOwedBOffset = 136;
          
          // Read whirlpool address
          const whirlpoolBytes = data.slice(whirlpoolOffset, whirlpoolOffset + 32);
          const whirlpool = new PublicKey(whirlpoolBytes).toString();
          
          // Read position mint
          const positionMintBytes = data.slice(positionMintOffset, positionMintOffset + 32);
          const positionMint = new PublicKey(positionMintBytes).toString();
          
          // Read liquidity (128-bit number, little endian)
          const liquidityBytes = data.slice(liquidityOffset, liquidityOffset + 16);
          const liquidity = liquidityBytes.readBigUInt64LE(0);
          
          // Read tick indices (32-bit signed integers, little endian)
          const tickLower = data.readInt32LE(tickLowerOffset);
          const tickUpper = data.readInt32LE(tickUpperOffset);
          
          // Read fee owed (64-bit numbers, little endian)
          const feeOwedA = data.readBigUInt64LE(feeOwedAOffset);
          const feeOwedB = data.readBigUInt64LE(feeOwedBOffset);
          
          console.log(`\n   📋 POSITION DATA:`);
          console.log(`   Whirlpool: ${whirlpool}`);
          console.log(`   Position Mint: ${positionMint}`);
          console.log(`   Liquidity: ${liquidity.toString()}`);
          console.log(`   Tick Lower: ${tickLower}`);
          console.log(`   Tick Upper: ${tickUpper}`);
          console.log(`   Fee Owed A: ${feeOwedA.toString()}`);
          console.log(`   Fee Owed B: ${feeOwedB.toString()}`);
          
          // Now get the whirlpool data
          console.log(`\n   🌊 Getting Whirlpool Data...`);
          const whirlpoolPubkey = new PublicKey(whirlpool);
          const whirlpoolAccount = await connection.getAccountInfo(whirlpoolPubkey);
          
          if (whirlpoolAccount) {
            console.log(`   ✅ Whirlpool found!`);
            
            const poolData = whirlpoolAccount.data;
            if (poolData.length >= 653) { // Expected whirlpool size
              
              // Parse whirlpool data (key fields)
              const tokenMintAOffset = 101;
              const tokenMintBOffset = 133;
              const tickSpacingOffset = 165;
              const tickCurrentIndexOffset = 169;
              const sqrtPriceOffset = 173;
              const feeRateOffset = 189;
              const protocolFeeRateOffset = 191;
              
              const tokenMintA = new PublicKey(poolData.slice(tokenMintAOffset, tokenMintAOffset + 32)).toString();
              const tokenMintB = new PublicKey(poolData.slice(tokenMintBOffset, tokenMintBOffset + 32)).toString();
              const tickSpacing = poolData.readUInt16LE(tickSpacingOffset);
              const tickCurrentIndex = poolData.readInt32LE(tickCurrentIndexOffset);
              const sqrtPrice = poolData.readBigUInt64LE(sqrtPriceOffset);
              const feeRate = poolData.readUInt16LE(feeRateOffset);
              const protocolFeeRate = poolData.readUInt16LE(protocolFeeRateOffset);
              
              console.log(`   📊 WHIRLPOOL DATA:`);
              console.log(`   Token Mint A: ${tokenMintA}`);
              console.log(`   Token Mint B: ${tokenMintB}`);
              console.log(`   Tick Spacing: ${tickSpacing}`);
              console.log(`   Current Tick: ${tickCurrentIndex}`);
              console.log(`   Sqrt Price: ${sqrtPrice.toString()}`);
              console.log(`   Fee Rate: ${feeRate} basis points (${feeRate/100}%)`);
              console.log(`   Protocol Fee Rate: ${protocolFeeRate} basis points`);
              
              // Check if position is in range
              const inRange = tickCurrentIndex >= tickLower && tickCurrentIndex < tickUpper;
              console.log(`\n   ✨ POSITION STATUS:`);
              console.log(`   In Range: ${inRange ? '✅ YES' : '❌ NO'}`);
              console.log(`   Current Tick: ${tickCurrentIndex}`);
              console.log(`   Position Range: [${tickLower}, ${tickUpper})`);
              
              // Get token symbols (this would require additional calls to get metadata)
              console.log(`\n   💰 TOKENS (addresses only - symbols need metadata lookup):`);
              console.log(`   Token A: ${tokenMintA}`);
              console.log(`   Token B: ${tokenMintB}`);
              
            } else {
              console.log(`   ❌ Unexpected whirlpool data size: ${poolData.length}`);
            }
          } else {
            console.log(`   ❌ Whirlpool not found: ${whirlpool}`);
          }
          
        } else {
          console.log(`   ❌ Unexpected position data size: ${positionAccount.data.length}`);
        }
      } else {
        console.log(`   ❌ Position PDA not found`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

lookupOrcaPositions().catch(console.error);