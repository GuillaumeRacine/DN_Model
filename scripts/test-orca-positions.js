#!/usr/bin/env node
require('dotenv').config();

const { Connection, PublicKey } = require('@solana/web3.js');
const { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PoolUtil, PriceMath } = require('@orca-so/whirlpools-sdk');
const { AnchorProvider } = require('@coral-xyz/anchor');

// Your Orca positions from .env
const ORCA_POSITIONS = [
  'FE1VVxiLxdUnBw1MA7ScHXaF98i2q9oiXnhnwK6x3ZsB',
  'DH2Wr385mowQ8wEi6wqWPrK4T9HxeKPbMUcumnLu9VnA', 
  'EmnwXx7swzFzABcZ2UnknPRNrFiH8shBnM5bFg6zEiZZ'
];

const SOLANA_WALLET = 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k';

async function testOrcaPositions() {
  console.log('🌊 Testing Orca Position Details\n');

  // Initialize connection with Helius
  const connection = new Connection(process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
  
  console.log('🔗 Connected to Solana RPC:', process.env.HELIUS_RPC_URL ? 'Helius' : 'Public RPC');

  // Create dummy wallet for read-only operations
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => { throw new Error('Read-only'); },
    signAllTransactions: async () => { throw new Error('Read-only'); },
  };

  try {
    // Initialize Whirlpool context
    const ctx = WhirlpoolContext.from(
      connection,
      dummyWallet,
      ORCA_WHIRLPOOL_PROGRAM_ID
    );

    const client = buildWhirlpoolClient(ctx);
    console.log('✅ Orca Whirlpool client initialized\n');

    // Test each position
    for (let i = 0; i < ORCA_POSITIONS.length; i++) {
      const positionAddress = ORCA_POSITIONS[i];
      console.log(`🏊‍♂️ Testing Position ${i + 1}: ${positionAddress}`);
      
      try {
        // Check if this is actually a token account or position
        const positionPubkey = new PublicKey(positionAddress);
        const accountInfo = await connection.getAccountInfo(positionPubkey);
        
        if (!accountInfo) {
          console.log('❌ Account not found on-chain');
          continue;
        }

        console.log(`📋 Account Info:`);
        console.log(`   Owner: ${accountInfo.owner.toString()}`);
        console.log(`   Data Length: ${accountInfo.data.length} bytes`);
        console.log(`   Executable: ${accountInfo.executable}`);
        console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL`);

        // Check if it's a token account (NFT holder)
        if (accountInfo.owner.toString() === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
          console.log('🎨 This is a Token Account - checking for NFT...');
          
          try {
            const parsed = await connection.getParsedAccountInfo(positionPubkey);
            if (parsed.value && 'parsed' in parsed.value.data) {
              const tokenInfo = parsed.value.data.parsed.info;
              console.log(`   Mint: ${tokenInfo.mint}`);
              console.log(`   Owner: ${tokenInfo.owner}`);
              console.log(`   Amount: ${tokenInfo.tokenAmount.uiAmount}`);
              
              if (tokenInfo.tokenAmount.uiAmount === 1) {
                console.log('🎯 This looks like a Position NFT!');
                
                // Try to get position data using the mint as the position
                try {
                  const mintPubkey = new PublicKey(tokenInfo.mint);
                  
                  // Derive position address from mint
                  const [positionPDA] = PDAUtil.getPosition(ORCA_WHIRLPOOL_PROGRAM_ID, mintPubkey);
                  console.log(`   Position PDA: ${positionPDA.toString()}`);
                  
                  const position = await client.getPosition(positionPDA);
                  if (position) {
                    const positionData = position.getData();
                    console.log('✅ Position Data Found:');
                    console.log(`   Whirlpool: ${positionData.whirlpool.toString()}`);
                    console.log(`   Liquidity: ${positionData.liquidity.toString()}`);
                    console.log(`   Tick Lower: ${positionData.tickLowerIndex}`);
                    console.log(`   Tick Upper: ${positionData.tickUpperIndex}`);
                    
                    // Get pool data
                    const whirlpool = await client.getPool(positionData.whirlpool);
                    if (whirlpool) {
                      const poolData = whirlpool.getData();
                      console.log('🏊‍♀️ Pool Data:');
                      console.log(`   Token A: ${poolData.tokenMintA.toString()}`);
                      console.log(`   Token B: ${poolData.tokenMintB.toString()}`);
                      console.log(`   Current Sqrt Price: ${poolData.sqrtPrice.toString()}`);
                      console.log(`   Tick Spacing: ${poolData.tickSpacing}`);
                      console.log(`   Fee Rate: ${poolData.feeRate} basis points`);
                      
                      // Get token info
                      const tokenA = whirlpool.getTokenAInfo();
                      const tokenB = whirlpool.getTokenBInfo();
                      
                      console.log('💰 Token Information:');
                      console.log(`   Token A: ${tokenA.symbol || 'Unknown'} (${tokenA.decimals} decimals)`);
                      console.log(`   Token B: ${tokenB.symbol || 'Unknown'} (${tokenB.decimals} decimals)`);
                      
                      // Calculate position amounts
                      const amounts = PoolUtil.getTokenAmountsFromLiquidity(
                        positionData.liquidity,
                        poolData.sqrtPrice,
                        PriceMath.tickIndexToSqrtPriceX64(positionData.tickLowerIndex),
                        PriceMath.tickIndexToSqrtPriceX64(positionData.tickUpperIndex),
                        true
                      );
                      
                      console.log('📊 Current Position Amounts:');
                      console.log(`   ${tokenA.symbol || 'Token A'}: ${(amounts.tokenA.toNumber() / Math.pow(10, tokenA.decimals)).toFixed(6)}`);
                      console.log(`   ${tokenB.symbol || 'Token B'}: ${(amounts.tokenB.toNumber() / Math.pow(10, tokenB.decimals)).toFixed(6)}`);
                      
                      // Calculate current price
                      const currentPrice = PriceMath.sqrtPriceX64ToPrice(
                        poolData.sqrtPrice,
                        tokenA.decimals,
                        tokenB.decimals
                      );
                      
                      const lowerPrice = PriceMath.tickIndexToPrice(
                        positionData.tickLowerIndex,
                        tokenA.decimals,
                        tokenB.decimals
                      );
                      
                      const upperPrice = PriceMath.tickIndexToPrice(
                        positionData.tickUpperIndex,
                        tokenA.decimals,
                        tokenB.decimals
                      );
                      
                      console.log('💹 Price Information:');
                      console.log(`   Current Price: ${currentPrice.toFixed(6)} ${tokenB.symbol}/${tokenA.symbol}`);
                      console.log(`   Lower Price: ${lowerPrice.toFixed(6)} ${tokenB.symbol}/${tokenA.symbol}`);
                      console.log(`   Upper Price: ${upperPrice.toFixed(6)} ${tokenB.symbol}/${tokenA.symbol}`);
                      
                      // Check if in range
                      const currentTick = PriceMath.sqrtPriceX64ToTickIndex(poolData.sqrtPrice);
                      const inRange = currentTick >= positionData.tickLowerIndex && currentTick < positionData.tickUpperIndex;
                      console.log(`   In Range: ${inRange ? '✅ YES' : '❌ NO'} (current tick: ${currentTick})`);
                      
                      // Calculate fees owed
                      console.log('💸 Fees Information:');
                      console.log(`   Fee Owed A: ${(positionData.feeOwedA.toNumber() / Math.pow(10, tokenA.decimals)).toFixed(6)} ${tokenA.symbol}`);
                      console.log(`   Fee Owed B: ${(positionData.feeOwedB.toNumber() / Math.pow(10, tokenB.decimals)).toFixed(6)} ${tokenB.symbol}`);
                    }
                  }
                } catch (positionError) {
                  console.log('❌ Could not fetch position data:', positionError.message);
                }
              }
            }
          } catch (parseError) {
            console.log('❌ Could not parse token account:', parseError.message);
          }
        }
        // Check if it's already a position account
        else if (accountInfo.owner.equals(ORCA_WHIRLPOOL_PROGRAM_ID)) {
          console.log('🏊‍♂️ This is an Orca Position account');
          
          try {
            const position = await client.getPosition(positionPubkey);
            if (position) {
              console.log('✅ Position found and parsed successfully!');
              // ... (same position parsing logic as above)
            }
          } catch (positionError) {
            console.log('❌ Could not parse as position:', positionError.message);
          }
        }
        else {
          console.log('❓ Unknown account type - not a token account or Orca position');
        }
        
      } catch (error) {
        console.log(`❌ Error testing position: ${error.message}`);
      }
      
      console.log('\n' + '─'.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('❌ Error initializing Orca client:', error);
  }
}

testOrcaPositions().catch(console.error);