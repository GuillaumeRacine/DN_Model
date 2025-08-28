#!/usr/bin/env node
require('dotenv').config();

const { Connection, PublicKey } = require('@solana/web3.js');
const { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil, PoolUtil, PriceMath } = require('@orca-so/whirlpools-sdk');

// Your Orca positions
const ORCA_POSITIONS = [
  'FE1VVxiLxdUnBw1MA7ScHXaF98i2q9oiXnhnwK6x3ZsB',
  'DH2Wr385mowQ8wEi6wqWPrK4T9HxeKPbMUcumnLu9VnA', 
  'EmnwXx7swzFzABcZ2UnknPRNrFiH8shBnM5bFg6zEiZZ'
];

const WALLET_ADDRESS = 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k';

// Known token program IDs
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

async function analyzeOrcaPositions() {
  console.log('🔍 Detailed Orca Position Analysis\n');

  const connection = new Connection(process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
  console.log('🔗 Connected to:', process.env.HELIUS_RPC_URL ? 'Helius RPC' : 'Public RPC');
  
  // Create dummy wallet
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => { throw new Error('Read-only'); },
    signAllTransactions: async () => { throw new Error('Read-only'); },
  };

  try {
    const ctx = WhirlpoolContext.from(connection, dummyWallet, ORCA_WHIRLPOOL_PROGRAM_ID);
    const client = buildWhirlpoolClient(ctx);
    console.log('✅ Orca client initialized\n');

    for (let i = 0; i < ORCA_POSITIONS.length; i++) {
      const positionAddress = ORCA_POSITIONS[i];
      console.log(`🏊‍♂️ Analyzing Position ${i + 1}: ${positionAddress}`);
      
      try {
        const positionPubkey = new PublicKey(positionAddress);
        
        // Get account info
        const accountInfo = await connection.getAccountInfo(positionPubkey);
        if (!accountInfo) {
          console.log('❌ Account not found');
          continue;
        }

        console.log(`📋 Account Details:`);
        console.log(`   Owner: ${accountInfo.owner.toString()}`);
        console.log(`   Size: ${accountInfo.data.length} bytes`);
        console.log(`   Lamports: ${(accountInfo.lamports / 1e9).toFixed(6)} SOL`);
        
        // Check if it's a token account (either regular or Token2022)
        if (accountInfo.owner.toString() === TOKEN_PROGRAM_ID || accountInfo.owner.toString() === TOKEN_2022_PROGRAM_ID) {
          console.log('🎨 Token Account detected - analyzing...');
          
          try {
            // Get parsed account info
            const parsedInfo = await connection.getParsedAccountInfo(positionPubkey);
            
            if (parsedInfo.value && 'parsed' in parsedInfo.value.data) {
              const tokenAccount = parsedInfo.value.data.parsed.info;
              console.log(`   Mint: ${tokenAccount.mint}`);
              console.log(`   Owner: ${tokenAccount.owner}`);
              console.log(`   Amount: ${tokenAccount.tokenAmount.uiAmount}`);
              console.log(`   Decimals: ${tokenAccount.tokenAmount.decimals}`);
              
              // Check if owner matches your wallet
              if (tokenAccount.owner === WALLET_ADDRESS) {
                console.log('✅ Owned by your wallet!');
              }
              
              // Check if it's an NFT (amount = 1, decimals = 0)
              if (tokenAccount.tokenAmount.uiAmount === 1 && tokenAccount.tokenAmount.decimals === 0) {
                console.log('🎯 This is an NFT - likely a Position NFT!');
                
                // Try to derive position PDA
                try {
                  const mintPubkey = new PublicKey(tokenAccount.mint);
                  const [positionPDA] = PDAUtil.getPosition(ORCA_WHIRLPOOL_PROGRAM_ID, mintPubkey);
                  
                  console.log(`   Position PDA: ${positionPDA.toString()}`);
                  
                  // Get position data
                  const position = await client.getPosition(positionPDA);
                  if (position) {
                    const positionData = position.getData();
                    console.log('\n🏊‍♀️ POSITION DATA:');
                    console.log(`   ✅ Valid Orca Position Found!`);
                    console.log(`   Whirlpool: ${positionData.whirlpool.toString()}`);
                    console.log(`   Position Mint: ${positionData.positionMint.toString()}`);
                    console.log(`   Liquidity: ${positionData.liquidity.toString()}`);
                    console.log(`   Tick Lower: ${positionData.tickLowerIndex}`);
                    console.log(`   Tick Upper: ${positionData.tickUpperIndex}`);
                    console.log(`   Fee Growth Checkpoint A: ${positionData.feeGrowthCheckpointA.toString()}`);
                    console.log(`   Fee Growth Checkpoint B: ${positionData.feeGrowthCheckpointB.toString()}`);
                    console.log(`   Fee Owed A: ${positionData.feeOwedA.toString()}`);
                    console.log(`   Fee Owed B: ${positionData.feeOwedB.toString()}`);
                    
                    // Get whirlpool data
                    const whirlpool = await client.getPool(positionData.whirlpool);
                    if (whirlpool) {
                      const poolData = whirlpool.getData();
                      console.log('\n🌊 WHIRLPOOL DATA:');
                      console.log(`   Token Mint A: ${poolData.tokenMintA.toString()}`);
                      console.log(`   Token Mint B: ${poolData.tokenMintB.toString()}`);
                      console.log(`   Token Vault A: ${poolData.tokenVaultA.toString()}`);
                      console.log(`   Token Vault B: ${poolData.tokenVaultB.toString()}`);
                      console.log(`   Tick Spacing: ${poolData.tickSpacing}`);
                      console.log(`   Fee Rate: ${poolData.feeRate} basis points (${poolData.feeRate / 100}%)`);
                      console.log(`   Current Sqrt Price: ${poolData.sqrtPrice.toString()}`);
                      console.log(`   Current Tick Index: ${poolData.tickCurrentIndex}`);
                      
                      // Get token info
                      try {
                        const tokenA = whirlpool.getTokenAInfo();
                        const tokenB = whirlpool.getTokenBInfo();
                        
                        console.log('\n💰 TOKEN INFO:');
                        console.log(`   Token A: ${tokenA.symbol || 'Unknown'} (${tokenA.name || 'Unknown'})`);
                        console.log(`   - Address: ${tokenA.mint.toString()}`);
                        console.log(`   - Decimals: ${tokenA.decimals}`);
                        console.log(`   Token B: ${tokenB.symbol || 'Unknown'} (${tokenB.name || 'Unknown'})`);
                        console.log(`   - Address: ${tokenB.mint.toString()}`);
                        console.log(`   - Decimals: ${tokenB.decimals}`);
                        
                        // Calculate current position amounts
                        try {
                          const amounts = PoolUtil.getTokenAmountsFromLiquidity(
                            positionData.liquidity,
                            poolData.sqrtPrice,
                            PriceMath.tickIndexToSqrtPriceX64(positionData.tickLowerIndex),
                            PriceMath.tickIndexToSqrtPriceX64(positionData.tickUpperIndex),
                            true
                          );
                          
                          const tokenAAmount = amounts.tokenA.toNumber() / Math.pow(10, tokenA.decimals);
                          const tokenBAmount = amounts.tokenB.toNumber() / Math.pow(10, tokenB.decimals);
                          
                          console.log('\n📊 CURRENT POSITION AMOUNTS:');
                          console.log(`   ${tokenA.symbol || 'Token A'}: ${tokenAAmount.toFixed(8)}`);
                          console.log(`   ${tokenB.symbol || 'Token B'}: ${tokenBAmount.toFixed(8)}`);
                          
                          // Calculate prices
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
                          
                          console.log('\n💹 PRICE RANGE:');
                          console.log(`   Current Price: ${currentPrice.toNumber().toFixed(8)} ${tokenB.symbol}/${tokenA.symbol}`);
                          console.log(`   Lower Price: ${lowerPrice.toNumber().toFixed(8)} ${tokenB.symbol}/${tokenA.symbol}`);
                          console.log(`   Upper Price: ${upperPrice.toNumber().toFixed(8)} ${tokenB.symbol}/${tokenA.symbol}`);
                          
                          // Check if in range
                          const inRange = poolData.tickCurrentIndex >= positionData.tickLowerIndex && 
                                         poolData.tickCurrentIndex < positionData.tickUpperIndex;
                          
                          console.log(`\n✨ POSITION STATUS:`);
                          console.log(`   In Range: ${inRange ? '✅ YES' : '❌ NO'}`);
                          console.log(`   Current Tick: ${poolData.tickCurrentIndex}`);
                          console.log(`   Range: [${positionData.tickLowerIndex}, ${positionData.tickUpperIndex})`);
                          
                          // Calculate fees
                          const feeOwedA = positionData.feeOwedA.toNumber() / Math.pow(10, tokenA.decimals);
                          const feeOwedB = positionData.feeOwedB.toNumber() / Math.pow(10, tokenB.decimals);
                          
                          console.log('\n💸 FEES OWED:');
                          console.log(`   ${tokenA.symbol}: ${feeOwedA.toFixed(8)}`);
                          console.log(`   ${tokenB.symbol}: ${feeOwedB.toFixed(8)}`);
                          
                        } catch (calcError) {
                          console.log('❌ Error calculating amounts:', calcError.message);
                        }
                        
                      } catch (tokenError) {
                        console.log('❌ Error getting token info:', tokenError.message);
                      }
                    }
                  } else {
                    console.log('❌ Could not load position data');
                  }
                } catch (pdaError) {
                  console.log('❌ Error deriving position PDA:', pdaError.message);
                }
              } else {
                console.log('ℹ️ Not an NFT (amount != 1 or decimals != 0)');
              }
            } else {
              console.log('❌ Could not parse token account data');
            }
          } catch (parseError) {
            console.log('❌ Error parsing account:', parseError.message);
          }
        } else {
          console.log(`❓ Unknown account type with owner: ${accountInfo.owner.toString()}`);
        }
        
      } catch (error) {
        console.log(`❌ Error analyzing position: ${error.message}`);
      }
      
      console.log('\n' + '='.repeat(100) + '\n');
    }
    
  } catch (error) {
    console.error('❌ Setup error:', error);
  }
}

analyzeOrcaPositions().catch(console.error);