const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const WALLET_ADDRESS = process.argv[2]; // Pass wallet address as argument
if (!WALLET_ADDRESS) {
  console.error('Please provide a wallet address as argument');
  console.error('Usage: node ethereum-position-scanner.js <wallet_address>');
  process.exit(1);
}

// RPC endpoints
const RPC_URLS = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/demo',
  base: 'https://base-mainnet.g.alchemy.com/v2/demo'
};

// Contract addresses
const CONTRACTS = {
  ethereum: {
    uniswapV3NFTManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
  },
  arbitrum: {
    uniswapV3NFTManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
  },
  base: {
    uniswapV3NFTManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    uniswapV3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    aerodrome: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' // Aerodrome Slipstream
  }
};

// Uniswap V3 NFT Position Manager ABI (minimal)
const NFT_MANAGER_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

// Pool ABI
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

// Factory ABI
const FACTORY_ABI = [
  'function getPool(address token0, address token1, uint24 fee) view returns (address)'
];

// ERC20 ABI
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

async function getTokenInfo(tokenAddress, provider) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();
    return { symbol, decimals, address: tokenAddress };
  } catch (error) {
    console.error(`Error getting token info for ${tokenAddress}:`, error.message);
    return { symbol: 'UNKNOWN', decimals: 18, address: tokenAddress };
  }
}

function tickToPrice(tick, decimals0, decimals1) {
  const price = Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
  return price;
}

async function scanUniswapV3Positions(chain, walletAddress) {
  console.log(`\nScanning ${chain} for Uniswap V3 positions...`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
  const nftManager = new ethers.Contract(
    CONTRACTS[chain].uniswapV3NFTManager,
    NFT_MANAGER_ABI,
    provider
  );
  const factory = new ethers.Contract(
    CONTRACTS[chain].uniswapV3Factory,
    FACTORY_ABI,
    provider
  );
  
  const positions = [];
  
  try {
    // Get NFT balance
    const balance = await nftManager.balanceOf(walletAddress);
    console.log(`Found ${balance} Uniswap V3 position NFTs on ${chain}`);
    
    for (let i = 0; i < balance; i++) {
      try {
        // Get token ID
        const tokenId = await nftManager.tokenOfOwnerByIndex(walletAddress, i);
        console.log(`\nProcessing position NFT #${tokenId}...`);
        
        // Get position details
        const position = await nftManager.positions(tokenId);
        
        // Get token info
        const token0Info = await getTokenInfo(position.token0, provider);
        const token1Info = await getTokenInfo(position.token1, provider);
        
        // Get pool address
        const poolAddress = await factory.getPool(
          position.token0,
          position.token1,
          position.fee
        );
        
        // Get pool data
        const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
        const slot0 = await pool.slot0();
        const currentTick = Number(slot0.tick);
        
        // Calculate prices
        const priceLower = tickToPrice(Number(position.tickLower), token0Info.decimals, token1Info.decimals);
        const priceUpper = tickToPrice(Number(position.tickUpper), token0Info.decimals, token1Info.decimals);
        const currentPrice = tickToPrice(currentTick, token0Info.decimals, token1Info.decimals);
        
        // Check if position is in range
        const inRange = currentTick >= Number(position.tickLower) && currentTick <= Number(position.tickUpper);
        
        // Estimate TVL (rough calculation)
        const liquidity = Number(position.liquidity);
        const tvlEstimate = liquidity > 0 ? (liquidity / 1e18) * currentPrice : 0;
        
        const positionData = {
          chain: chain.toUpperCase(),
          protocol: 'Uniswap V3',
          tokenId: tokenId.toString(),
          poolAddress,
          tokenPair: `${token0Info.symbol}/${token1Info.symbol}`,
          token0: token0Info.address,
          token1: token1Info.address,
          fee: Number(position.fee) / 10000, // Convert to percentage
          liquidity: position.liquidity.toString(),
          tickLower: Number(position.tickLower),
          tickUpper: Number(position.tickUpper),
          currentTick,
          priceLower,
          priceUpper,
          currentPrice,
          inRange,
          tvlEstimate
        };
        
        positions.push(positionData);
        
        console.log(`✅ Position found: ${token0Info.symbol}/${token1Info.symbol}`);
        console.log(`   Range: ${priceLower.toFixed(4)} - ${priceUpper.toFixed(4)}`);
        console.log(`   Current: ${currentPrice.toFixed(4)} (${inRange ? 'IN RANGE' : 'OUT OF RANGE'})`);
        console.log(`   Liquidity: ${position.liquidity.toString()}`);
        
      } catch (error) {
        console.error(`Error processing position ${i}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error scanning ${chain}:`, error.message);
  }
  
  return positions;
}

async function scanAerodromePositions(walletAddress) {
  console.log(`\nScanning Base for Aerodrome positions...`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URLS.base);
  
  // Aerodrome uses a similar NFT system to Uniswap V3
  // For now, we'll use the Graph API or similar service
  // This is a placeholder for actual implementation
  
  console.log('Aerodrome scanning requires additional API setup');
  return [];
}

async function main() {
  console.log(`\n🔍 Scanning positions for wallet: ${WALLET_ADDRESS}\n`);
  console.log('='.repeat(60));
  
  const allPositions = [];
  
  // Scan Ethereum mainnet
  const ethPositions = await scanUniswapV3Positions('ethereum', WALLET_ADDRESS);
  allPositions.push(...ethPositions);
  
  // Scan Arbitrum
  const arbPositions = await scanUniswapV3Positions('arbitrum', WALLET_ADDRESS);
  allPositions.push(...arbPositions);
  
  // Scan Base
  const basePositions = await scanUniswapV3Positions('base', WALLET_ADDRESS);
  allPositions.push(...basePositions);
  
  // Scan Aerodrome on Base
  const aerodromePositions = await scanAerodromePositions(WALLET_ADDRESS);
  allPositions.push(...aerodromePositions);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 POSITION SUMMARY`);
  console.log(`Total positions found: ${allPositions.length}`);
  console.log(`In-range positions: ${allPositions.filter(p => p.inRange).length}`);
  console.log(`Out-of-range positions: ${allPositions.filter(p => !p.inRange).length}`);
  
  // Save results
  const fs = require('fs');
  const outputFile = 'ethereum-positions.json';
  fs.writeFileSync(outputFile, JSON.stringify(allPositions, null, 2));
  console.log(`\n💾 Results saved to ${outputFile}`);
  
  // Format for integration
  console.log('\n📋 FORMATTED FOR INTEGRATION:\n');
  allPositions.forEach((pos, idx) => {
    console.log(`Position ${idx + 1}:`);
    console.log(`  Chain: ${pos.chain}`);
    console.log(`  Protocol: ${pos.protocol}`);
    console.log(`  Pair: ${pos.tokenPair}`);
    console.log(`  Fee Tier: ${pos.fee}%`);
    console.log(`  Status: ${pos.inRange ? '✅ IN RANGE' : '❌ OUT OF RANGE'}`);
    console.log(`  Price Range: ${pos.priceLower.toFixed(2)} - ${pos.priceUpper.toFixed(2)}`);
    console.log(`  Current Price: ${pos.currentPrice.toFixed(2)}`);
    console.log('');
  });
}

main().catch(console.error);