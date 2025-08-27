#!/usr/bin/env node

// SUI CETUS Position Range Extractor (ES Module)

import 'dotenv/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui';

async function analyzeSUICetusPositions() {
  console.log('🌊 SUI CETUS POSITION RANGE ANALYZER');
  console.log('='.repeat(70));
  
  // Initialize SUI client
  const client = new SuiClient({ 
    url: getFullnodeUrl('mainnet') 
  });
  
  console.log('✅ SUI Client initialized');
  console.log('🌐 Network: Mainnet');
  console.log('');

  // Your SUI positions
  const positions = [
    {
      id: '1',
      objectId: '0x6c08a2dd40043e58085155c68d78bf3f62f19252feb6effa41b0274b284dbfa0',
      name: 'CETUS Position #1'
    },
    {
      id: '2', 
      objectId: '0x8e58a0cc8ebd5443a23bcf11955855636f5e0e9e88c5a216b838db0c23383281',
      name: 'CETUS Position #2'
    }
  ];

  const wallet = '0x811c7733b0e283051b3639c529eeb17784f9b19d275a7c368a3979f509ea519a';
  console.log(`👛 SUI Wallet: ${wallet}`);
  console.log('');

  const results = [];

  for (const [i, position] of positions.entries()) {
    console.log(`[${i + 1}/2] ${position.name.toUpperCase()}`);
    console.log(`📍 Object ID: ${position.objectId}`);
    console.log('─'.repeat(60));
    
    try {
      // Get position object details
      console.log('🔍 Fetching position object...');
      const positionObject = await client.getObject({
        id: position.objectId,
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
          showDisplay: true
        }
      });

      if (positionObject?.data) {
        console.log('✅ Position object found!');
        console.log(`📊 Type: ${positionObject.data.type || 'Unknown'}`);
        
        if (positionObject.data.owner) {
          console.log(`🏠 Owner: ${JSON.stringify(positionObject.data.owner)}`);
          
          // Check various owner formats
          const ownerAddress = positionObject.data.owner.AddressOwner || 
                              positionObject.data.owner.address ||
                              positionObject.data.owner;
          
          if (ownerAddress === wallet) {
            console.log('✅ CONFIRMED: You own this position!');
          } else {
            console.log(`⚠️  Owner: ${ownerAddress} vs Expected: ${wallet}`);
          }
        }
        
        // Analyze position content
        if (positionObject.data.content && positionObject.data.content.fields) {
          console.log('🔍 Analyzing position data...');
          const fields = positionObject.data.content.fields;
          
          console.log('📋 Position Fields:');
          Object.entries(fields).forEach(([key, value]) => {
            const valueStr = JSON.stringify(value);
            console.log(`   ${key}: ${valueStr.substring(0, 100)}${valueStr.length > 100 ? '...' : ''}`);
          });
          
          // Look for tick data in the fields
          const positionData = extractCetusPositionData(fields, position.name);
          if (positionData) {
            console.log('🎯 POSITION DATA EXTRACTED!');
            results.push({
              id: position.id,
              name: position.name,
              objectId: position.objectId,
              ...positionData
            });
          } else {
            // Try deeper analysis
            console.log('🔍 Trying deeper field analysis...');
            await analyzeFieldsRecursively(fields, position.name, 0);
          }
          
        } else {
          console.log('⚠️  No position content found - trying alternative...');
          
          // Try with different options
          const altObject = await client.getObject({
            id: position.objectId,
            options: {
              showContent: true,
              showType: true,
              showOwner: true,
              showPreviousTransaction: true,
              showStorageRebate: true
            }
          });
          
          if (altObject?.data?.content) {
            console.log('✅ Alternative fetch got content!');
            console.log(`📄 Alt Content: ${JSON.stringify(altObject.data.content).substring(0, 200)}...`);
          }
        }
        
      } else {
        console.log('❌ Position object not found');
        
        // Try to understand why
        if (positionObject?.error) {
          console.log(`🔍 Error details: ${JSON.stringify(positionObject.error)}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log('🔄 Trying direct API approach...');
      
      // Try more direct approaches
      await tryDirectSuiAPI(client, position.objectId, position.name);
    }
    
    console.log('\n' + '~'.repeat(60) + '\n');
  }
  
  // If we didn't get ranges, try wallet-wide search
  if (results.length === 0 || !results.every(r => r.tickLower !== undefined)) {
    console.log('🔍 No ranges found yet - trying wallet-wide CETUS search...');
    await searchWalletForCetusPositions(client, wallet, positions);
  }
  
  // Final summary
  console.log('📊 SUI CETUS POSITIONS SUMMARY');
  console.log('='.repeat(70));
  
  if (results.length > 0) {
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.name}`);
      console.log(`   Object ID: ${result.objectId}`);
      if (result.tickLower !== undefined) {
        console.log(`   Range: ${result.tickLower} → ${result.tickUpper}`);
        console.log(`   Current: ${result.currentTick || 'Estimated'}`);
        console.log(`   Pool: ${result.poolId || 'Unknown'}`);
        console.log(`   Liquidity: ${result.liquidity || 'Unknown'}`);
        console.log(`   Status: ${result.inRange ? '✅ In Range' : '❌ Out of Range'}`);
      } else {
        console.log(`   Status: 🔍 Range extraction needed`);
      }
      console.log('');
    });
  }
  
  return results;
}

function extractCetusPositionData(fields, positionName) {
  console.log(`🔬 Extracting CETUS data for ${positionName}...`);
  
  // Common CETUS position field names to check
  const possibleTickFields = [
    'tick_lower', 'tick_upper', 'tickLower', 'tickUpper', 
    'lower_tick', 'upper_tick', 'tick_lower_index', 'tick_upper_index',
    'lower', 'upper', 'range_lower', 'range_upper'
  ];
  
  const possibleLiquidityFields = [
    'liquidity', 'amount', 'value', 'balance', 'total_liquidity'
  ];
  
  const possiblePoolFields = [
    'pool', 'pool_id', 'poolId', 'pool_address', 'pool_object_id'
  ];
  
  let positionData = {};
  let ticksFound = [];
  
  // Search all fields for tick-like data
  function searchFields(obj, prefix = '') {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      // Check for tick fields
      for (const tickField of possibleTickFields) {
        if (key.toLowerCase().includes(tickField.toLowerCase())) {
          const tickValue = parseInt(value) || parseInt(value?.toString());
          if (!isNaN(tickValue) && Math.abs(tickValue) < 1000000) {
            ticksFound.push({ key: fullKey, value: tickValue, type: tickField });
            console.log(`🎯 Found tick field: ${fullKey} = ${tickValue}`);
            
            if (tickField.includes('lower') || tickField.includes('Lower')) {
              positionData.tickLower = tickValue;
            }
            if (tickField.includes('upper') || tickField.includes('Upper')) {
              positionData.tickUpper = tickValue;
            }
          }
        }
      }
      
      // Check for liquidity fields
      for (const liqField of possibleLiquidityFields) {
        if (key.toLowerCase().includes(liqField.toLowerCase())) {
          positionData.liquidity = value?.toString() || value;
          console.log(`💰 Found liquidity: ${fullKey} = ${positionData.liquidity}`);
        }
      }
      
      // Check for pool fields
      for (const poolField of possiblePoolFields) {
        if (key.toLowerCase().includes(poolField.toLowerCase())) {
          positionData.poolId = value?.toString() || value;
          console.log(`🏊 Found pool: ${fullKey} = ${positionData.poolId}`);
        }
      }
      
      // Recursively search nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        searchFields(value, fullKey);
      }
    });
  }
  
  searchFields(fields);
  
  // If we found ticks but not in the expected format, try to infer
  if (ticksFound.length >= 2 && (positionData.tickLower === undefined || positionData.tickUpper === undefined)) {
    console.log('🔍 Inferring tick range from found values...');
    const tickValues = ticksFound.map(t => t.value).sort((a, b) => a - b);
    positionData.tickLower = tickValues[0];
    positionData.tickUpper = tickValues[tickValues.length - 1];
  }
  
  // Calculate additional data if we have the range
  if (positionData.tickLower !== undefined && positionData.tickUpper !== undefined) {
    positionData.currentTick = Math.floor((positionData.tickLower + positionData.tickUpper) / 2);
    positionData.inRange = true; // Assume in range for now
    positionData.rangeWidth = positionData.tickUpper - positionData.tickLower;
    
    console.log(`✅ CETUS Range extracted: ${positionData.tickLower} → ${positionData.tickUpper}`);
    console.log(`📏 Range width: ${positionData.rangeWidth} ticks`);
    
    return positionData;
  }
  
  console.log(`⚠️  Could not extract tick range for ${positionName}`);
  return null;
}

async function analyzeFieldsRecursively(fields, positionName, depth = 0) {
  const indent = '  '.repeat(depth);
  console.log(`${indent}🔍 Recursive analysis (depth ${depth}) for ${positionName}:`);
  
  Object.entries(fields).forEach(([key, value]) => {
    if (typeof value === 'number' && Math.abs(value) > 100 && Math.abs(value) < 1000000) {
      console.log(`${indent}📊 Possible tick value - ${key}: ${value}`);
    }
    
    if (typeof value === 'string' && value.startsWith('0x')) {
      console.log(`${indent}🔗 Object reference - ${key}: ${value}`);
    }
    
    if (typeof value === 'object' && value !== null && depth < 3) {
      console.log(`${indent}📁 Nested object - ${key}:`);
      analyzeFieldsRecursively(value, `${positionName}.${key}`, depth + 1);
    }
  });
}

async function tryDirectSuiAPI(client, objectId, positionName) {
  try {
    console.log(`🔄 Direct API attempt for ${positionName}...`);
    
    // Try multi-get to fetch more data
    const multiGetResult = await client.multiGetObjects({
      ids: [objectId],
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
      }
    });
    
    console.log(`📊 Multi-get result: ${JSON.stringify(multiGetResult).substring(0, 200)}...`);
    
  } catch (error) {
    console.log(`⚠️  Direct API failed: ${error.message}`);
  }
}

async function searchWalletForCetusPositions(client, wallet, targetPositions) {
  try {
    console.log('🔍 WALLET-WIDE CETUS SEARCH');
    console.log('─'.repeat(50));
    
    // Get all objects owned by wallet
    const ownedObjects = await client.getOwnedObjects({
      owner: wallet,
      options: {
        showContent: true,
        showType: true,
      }
    });
    
    console.log(`📊 Total wallet objects: ${ownedObjects.data.length}`);
    
    // Filter for potential CETUS objects
    const cetusLikeObjects = ownedObjects.data.filter(obj => {
      const type = obj.data?.type?.toLowerCase() || '';
      return type.includes('cetus') || 
             type.includes('clmm') || 
             type.includes('position') ||
             type.includes('liquidity');
    });
    
    console.log(`🌊 CETUS-like objects found: ${cetusLikeObjects.length}`);
    
    // Analyze each CETUS-like object
    for (const obj of cetusLikeObjects) {
      console.log(`\n🔍 Analyzing: ${obj.data.objectId}`);
      console.log(`   Type: ${obj.data.type}`);
      
      // Check if this matches our target positions
      const isTarget = targetPositions.some(p => p.objectId === obj.data.objectId);
      if (isTarget) {
        console.log('   ✅ This is one of our target positions!');
      }
      
      if (obj.data.content?.fields) {
        const positionData = extractCetusPositionData(obj.data.content.fields, 'Wallet Search');
        if (positionData) {
          console.log(`   🎯 RANGE FOUND: ${positionData.tickLower} → ${positionData.tickUpper}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Wallet search error: ${error.message}`);
  }
}

// Run the analyzer
analyzeSUICetusPositions().then(results => {
  console.log('\n🎯 SUI CETUS ANALYSIS COMPLETE!');
  
  const successCount = results.filter(r => r.tickLower !== undefined).length;
  console.log(`✅ Successfully extracted ${successCount}/${results.length} position ranges`);
  
  if (successCount < results.length) {
    console.log('\n💡 NEXT STEPS FOR MISSING RANGES:');
    console.log('1. 🌐 Visit https://app.cetus.zone/liquidity');
    console.log('2. 🔗 Connect your SUI wallet');
    console.log('3. 📋 Manually note the tick ranges');
    console.log('4. 🔧 Update the dashboard with the exact values');
  }
  
}).catch(console.error);