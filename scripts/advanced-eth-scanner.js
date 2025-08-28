const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

// Configuration - UPDATE THIS WITH YOUR WALLET
const WALLET_ADDRESS = process.argv[2] || '0x811c7733b0e283051b3639c529eeb17784f9b19d275a7c368a3979f509ea519a';

console.log(`🔍 Scanning wallet: ${WALLET_ADDRESS}`);

// Enhanced RPC endpoints with fallbacks
const RPC_ENDPOINTS = {
  ethereum: [
    'https://eth-mainnet.g.alchemy.com/v2/demo',
    'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.ankr.com/eth'
  ],
  arbitrum: [
    'https://arb-mainnet.g.alchemy.com/v2/demo',
    'https://arbitrum-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://rpc.ankr.com/arbitrum'
  ],
  base: [
    'https://base-mainnet.g.alchemy.com/v2/demo',
    'https://mainnet.base.org',
    'https://rpc.ankr.com/base'
  ]
};

// GraphQL endpoints for position data
const GRAPH_ENDPOINTS = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal',
  base: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest'
};

async function getProvider(chain) {
  for (const url of RPC_ENDPOINTS[chain]) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // Test connection
      console.log(`✅ Connected to ${chain} via ${url.split('/')[2]}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed to connect to ${url.split('/')[2]}`);
    }
  }
  throw new Error(`Could not connect to ${chain}`);
}

// Query The Graph for positions
async function queryGraphPositions(chain, walletAddress) {
  const query = `
    query getPositions($owner: String!) {
      positions(where: { owner: $owner }) {
        id
        tokenId
        owner
        pool {
          id
          token0 {
            id
            symbol
            decimals
          }
          token1 {
            id
            symbol
            decimals
          }
          feeTier
          sqrtPrice
          tick
          liquidity
        }
        tickLower {
          tickIdx
        }
        tickUpper {
          tickIdx
        }
        liquidity
        depositedToken0
        depositedToken1
        withdrawnToken0
        withdrawnToken1
        collectedFeesToken0
        collectedFeesToken1
        feeGrowthInside0LastX128
        feeGrowthInside1LastX128
      }
    }
  `;

  try {
    const response = await axios.post(
      GRAPH_ENDPOINTS[chain],
      {
        query,
        variables: { owner: walletAddress.toLowerCase() }
      }
    );

    if (response.data && response.data.data) {
      return response.data.data.positions || [];
    }
  } catch (error) {
    console.error(`Graph query failed for ${chain}:`, error.message);
  }
  
  return [];
}

// Enhanced position scanner using multiple methods
async function enhancedScan(chain, walletAddress) {
  console.log(`\n📊 Enhanced scanning ${chain.toUpperCase()}...`);
  
  const positions = [];
  
  // Method 1: Query The Graph
  const graphPositions = await queryGraphPositions(chain, walletAddress);
  console.log(`Found ${graphPositions.length} positions via The Graph`);
  
  if (graphPositions.length > 0) {
    for (const pos of graphPositions) {
      try {
        const tickLower = pos.tickLower ? Number(pos.tickLower.tickIdx) : 0;
        const tickUpper = pos.tickUpper ? Number(pos.tickUpper.tickIdx) : 0;
        const currentTick = pos.pool.tick ? Number(pos.pool.tick) : 0;
        
        // Calculate prices
        const token0Decimals = Number(pos.pool.token0.decimals);
        const token1Decimals = Number(pos.pool.token1.decimals);
        const decimalDiff = token0Decimals - token1Decimals;
        
        const priceLower = Math.pow(1.0001, tickLower) * Math.pow(10, decimalDiff);
        const priceUpper = Math.pow(1.0001, tickUpper) * Math.pow(10, decimalDiff);
        const currentPrice = Math.pow(1.0001, currentTick) * Math.pow(10, decimalDiff);
        
        const inRange = currentTick >= tickLower && currentTick <= tickUpper;
        
        // Calculate TVL using deposited amounts
        const token0Value = Number(pos.depositedToken0) - Number(pos.withdrawnToken0);
        const token1Value = Number(pos.depositedToken1) - Number(pos.withdrawnToken1);
        
        positions.push({
          chain: chain.toUpperCase(),
          protocol: 'Uniswap V3',
          tokenId: pos.tokenId,
          poolAddress: pos.pool.id,
          tokenPair: `${pos.pool.token0.symbol}/${pos.pool.token1.symbol}`,
          token0: pos.pool.token0.id,
          token1: pos.pool.token1.id,
          fee: Number(pos.pool.feeTier) / 10000,
          liquidity: pos.liquidity,
          tickLower,
          tickUpper,
          currentTick,
          priceLower,
          priceUpper,
          currentPrice,
          inRange,
          depositedToken0: token0Value,
          depositedToken1: token1Value
        });
        
        console.log(`  ✅ ${pos.pool.token0.symbol}/${pos.pool.token1.symbol} - ${inRange ? 'IN RANGE' : 'OUT OF RANGE'}`);
      } catch (error) {
        console.error(`Error processing position:`, error.message);
      }
    }
  }
  
  // Method 2: Direct RPC scanning as fallback
  if (positions.length === 0) {
    console.log('Falling back to direct RPC scanning...');
    const provider = await getProvider(chain);
    
    // Scan for NFT positions directly
    const NFT_MANAGER_ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
      'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
    ];
    
    const nftManagerAddress = chain === 'base' 
      ? '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1'
      : '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
      
    const nftManager = new ethers.Contract(nftManagerAddress, NFT_MANAGER_ABI, provider);
    
    try {
      const balance = await nftManager.balanceOf(walletAddress);
      console.log(`Found ${balance} position NFTs via direct RPC`);
      
      for (let i = 0; i < Math.min(balance, 10); i++) { // Limit to 10 for speed
        try {
          const tokenId = await nftManager.tokenOfOwnerByIndex(walletAddress, i);
          const position = await nftManager.positions(tokenId);
          
          console.log(`  Found position NFT #${tokenId}`);
          
          positions.push({
            chain: chain.toUpperCase(),
            protocol: 'Uniswap V3',
            tokenId: tokenId.toString(),
            token0: position.token0,
            token1: position.token1,
            fee: Number(position.fee) / 10000,
            liquidity: position.liquidity.toString(),
            tickLower: Number(position.tickLower),
            tickUpper: Number(position.tickUpper),
            inRange: null // Will need pool data to determine
          });
        } catch (error) {
          console.error(`Error fetching position ${i}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`RPC scan failed:`, error.message);
    }
  }
  
  return positions;
}

// DeFiLlama API for TVL data
async function enrichWithTVL(positions) {
  console.log('\n💰 Enriching with TVL data...');
  
  for (const pos of positions) {
    try {
      // Get pool TVL from DeFiLlama
      const response = await axios.get(
        `https://api.llama.fi/v2/getFees?pool=${pos.poolAddress}`
      ).catch(() => null);
      
      if (response && response.data) {
        pos.tvlUsd = response.data.tvl || 0;
      }
      
      // Estimate position share of TVL
      if (pos.liquidity && pos.tvlUsd) {
        // This is a rough estimate
        pos.positionTVL = (Number(pos.liquidity) / 1e18) * 1000; // Rough conversion
      }
    } catch (error) {
      console.error(`TVL fetch failed for ${pos.tokenPair}:`, error.message);
    }
  }
  
  return positions;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 ADVANCED ETHEREUM POSITION SCANNER');
  console.log('='.repeat(70));
  
  const allPositions = [];
  
  // Scan each chain
  for (const chain of ['ethereum', 'arbitrum', 'base']) {
    const positions = await enhancedScan(chain, WALLET_ADDRESS);
    allPositions.push(...positions);
  }
  
  // Enrich with TVL data
  const enrichedPositions = await enrichWithTVL(allPositions);
  
  // Display results
  console.log('\n' + '='.repeat(70));
  console.log('📊 SCAN RESULTS');
  console.log('='.repeat(70));
  
  if (enrichedPositions.length === 0) {
    console.log('\n❌ No positions found for this wallet');
    console.log('\nPossible reasons:');
    console.log('1. The wallet has no LP positions on these chains');
    console.log('2. The positions are in protocols other than Uniswap V3');
    console.log('3. The Graph API is not returning data');
    
    console.log('\n🔍 Checking if this is a valid Ethereum address...');
    try {
      const provider = await getProvider('ethereum');
      const code = await provider.getCode(WALLET_ADDRESS);
      const balance = await provider.getBalance(WALLET_ADDRESS);
      
      console.log(`Address type: ${code === '0x' ? 'EOA (External Owned Account)' : 'Contract'}`);
      console.log(`ETH Balance: ${ethers.formatEther(balance)} ETH`);
    } catch (error) {
      console.error('Error checking address:', error.message);
    }
  } else {
    console.log(`\n✅ Found ${enrichedPositions.length} total positions\n`);
    
    enrichedPositions.forEach((pos, idx) => {
      console.log(`Position ${idx + 1}:`);
      console.log(`  🔗 Chain: ${pos.chain}`);
      console.log(`  📊 Protocol: ${pos.protocol}`);
      console.log(`  💱 Pair: ${pos.tokenPair || 'Unknown'}`);
      if (pos.fee) console.log(`  💰 Fee Tier: ${pos.fee}%`);
      if (pos.inRange !== null) {
        console.log(`  📍 Status: ${pos.inRange ? '✅ IN RANGE' : '❌ OUT OF RANGE'}`);
      }
      if (pos.priceLower && pos.priceUpper) {
        console.log(`  📈 Range: ${pos.priceLower.toFixed(4)} - ${pos.priceUpper.toFixed(4)}`);
        console.log(`  💹 Current: ${pos.currentPrice.toFixed(4)}`);
      }
      if (pos.tvlUsd) console.log(`  💵 TVL: $${pos.tvlUsd.toLocaleString()}`);
      console.log('');
    });
    
    // Save to file
    const fs = require('fs');
    fs.writeFileSync(
      'ethereum-positions-enhanced.json',
      JSON.stringify(enrichedPositions, null, 2)
    );
    console.log('💾 Full data saved to ethereum-positions-enhanced.json');
  }
}

main().catch(console.error);