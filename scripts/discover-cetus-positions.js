#!/usr/bin/env node

// Discover all CETUS LP positions owned by a SUI wallet

require('dotenv').config();
const axios = require('axios');

const SUI_RPC_URL = 'https://fullnode.mainnet.sui.io:443';

async function suiRpcCall(method, params) {
  try {
    const response = await axios.post(SUI_RPC_URL, {
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.error) {
      throw new Error(`SUI RPC Error: ${response.data.error.message}`);
    }
    
    return response.data.result;
  } catch (error) {
    throw new Error(`SUI RPC call failed: ${error.message}`);
  }
}

async function discoverCetusPositions(walletAddress) {
  console.log('🔍 DISCOVERING ALL CETUS LP POSITIONS');
  console.log('='.repeat(70));
  console.log(`Wallet: ${walletAddress}`);
  console.log('');
  
  try {
    // Get all objects owned by the wallet
    // We need to paginate through all objects
    let cursor = null;
    let allObjects = [];
    let hasNextPage = true;
    
    console.log('📊 Fetching all wallet objects...');
    
    while (hasNextPage) {
      const response = await suiRpcCall('suix_getOwnedObjects', [
        walletAddress,
        {
          filter: null,
          options: {
            showType: true,
            showContent: true,
            showDisplay: true
          }
        },
        cursor,
        50 // limit per page
      ]);
      
      if (response.data && response.data.length > 0) {
        allObjects.push(...response.data);
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
      } else {
        hasNextPage = false;
      }
    }
    
    console.log(`Total objects found: ${allObjects.length}`);
    
    // Filter for CETUS position objects
    // CETUS positions have type containing "position::Position"
    const cetusPositions = allObjects.filter(obj => {
      const type = obj.data?.type || '';
      // Check for CETUS position package ID
      return type.includes('1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::position::Position');
    });
    
    console.log(`\n✅ Found ${cetusPositions.length} CETUS positions`);
    console.log('='.repeat(70));
    
    // Analyze each position
    for (const [i, obj] of cetusPositions.entries()) {
      console.log(`\n📍 POSITION ${i + 1}`);
      console.log('-'.repeat(60));
      
      const data = obj.data;
      const fields = data?.content?.fields;
      const display = data?.display?.data;
      
      console.log(`Object ID: ${data.objectId}`);
      console.log(`Type: ${data.type}`);
      
      if (display) {
        console.log(`\n📋 Display Info:`);
        console.log(`  Name: ${display.name}`);
        console.log(`  Description: ${display.description}`);
        console.log(`  Link: ${display.link}`);
      }
      
      if (fields) {
        // Extract token types
        const tokenA = fields.coin_type_a?.fields?.name;
        const tokenB = fields.coin_type_b?.fields?.name;
        
        // Parse token symbols
        const symbolA = tokenA?.split('::').pop() || 'Unknown';
        const symbolB = tokenB?.split('::').pop() || 'Unknown';
        
        console.log(`\n🪙 Token Pair: ${symbolA}/${symbolB}`);
        console.log(`  Token A: ${tokenA}`);
        console.log(`  Token B: ${tokenB}`);
        
        // Position details
        console.log(`\n📊 Position Details:`);
        console.log(`  Pool ID: ${fields.pool}`);
        console.log(`  Position Index: ${fields.index}`);
        console.log(`  Liquidity: ${fields.liquidity || '0'}`);
        console.log(`  Tick Lower: ${fields.tick_lower_index?.fields?.bits}`);
        console.log(`  Tick Upper: ${fields.tick_upper_index?.fields?.bits}`);
        
        // Check if position has liquidity
        const liquidity = BigInt(fields.liquidity || '0');
        if (liquidity > 0n) {
          console.log(`  ✅ ACTIVE - Has liquidity`);
        } else {
          console.log(`  ⚠️  EMPTY - No liquidity`);
        }
        
        // Check if this could be ETH-USDC
        if ((tokenA?.includes('eth') || tokenB?.includes('eth')) && 
            (tokenA?.includes('usdc') || tokenB?.includes('usdc'))) {
          console.log(`  🎯 This is an ETH-USDC position!`);
        }
        
        // Check if this could be SUI-USDC
        if ((tokenA?.includes('sui') || tokenB?.includes('sui')) && 
            (tokenA?.includes('usdc') || tokenB?.includes('usdc'))) {
          console.log(`  🎯 This is a SUI-USDC position!`);
        }
      }
    }
    
    // Summary
    console.log('\n');
    console.log('='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    
    const activePositions = cetusPositions.filter(obj => {
      const liquidity = BigInt(obj.data?.content?.fields?.liquidity || '0');
      return liquidity > 0n;
    });
    
    console.log(`Total CETUS positions: ${cetusPositions.length}`);
    console.log(`Active positions (with liquidity): ${activePositions.length}`);
    console.log(`Empty positions (no liquidity): ${cetusPositions.length - activePositions.length}`);
    
    // List all position IDs for easy copying
    console.log('\n📝 POSITION OBJECT IDs:');
    cetusPositions.forEach((obj, i) => {
      const liquidity = BigInt(obj.data?.content?.fields?.liquidity || '0');
      const status = liquidity > 0n ? '✅ ACTIVE' : '⚠️  EMPTY';
      console.log(`${i + 1}. ${obj.data.objectId} (${status})`);
    });
    
    return cetusPositions;
    
  } catch (error) {
    console.error('❌ Error discovering positions:', error.message);
    
    // If the extended RPC method doesn't work, try the basic one
    if (error.message.includes('Method not found')) {
      console.log('\n🔄 Trying alternative method...');
      return discoverWithBasicRPC(walletAddress);
    }
    
    return [];
  }
}

// Fallback method using basic RPC
async function discoverWithBasicRPC(walletAddress) {
  try {
    // Use the known position IDs as a fallback
    console.log('Using known position IDs to check ownership...');
    
    const knownPositions = [
      '0x6c08a2dd40043e58085155c68d78bf3f62f19252feb6effa41b0274b284dbfa0',
      '0x8e58a0cc8ebd5443a23bcf11955855636f5e0e9e88c5a216b838db0c23383281'
    ];
    
    const ownedPositions = [];
    
    for (const positionId of knownPositions) {
      const obj = await suiRpcCall('sui_getObject', [
        positionId,
        {
          showOwner: true,
          showContent: true,
          showType: true,
          showDisplay: true
        }
      ]);
      
      if (obj?.data?.owner?.AddressOwner === walletAddress ||
          obj?.data?.owner === walletAddress) {
        console.log(`✅ Position ${positionId} is owned by wallet`);
        ownedPositions.push(obj);
      }
    }
    
    return ownedPositions;
    
  } catch (error) {
    console.error('❌ Fallback method also failed:', error.message);
    return [];
  }
}

// Main execution
async function main() {
  const walletAddress = '0x811c7733b0e283051b3639c529eeb17784f9b19d275a7c368a3979f509ea519a';
  
  const positions = await discoverCetusPositions(walletAddress);
  
  if (positions.length === 0) {
    console.log('\n⚠️  No CETUS positions found for this wallet');
    console.log('This could mean:');
    console.log('1. The wallet has no CETUS positions');
    console.log('2. The positions were closed/migrated');
    console.log('3. RPC access limitations');
  }
}

main().catch(console.error);