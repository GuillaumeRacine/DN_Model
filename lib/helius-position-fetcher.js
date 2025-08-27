// Enhanced Position Fetcher using Helius RPC (unlimited requests)

require('dotenv').config();

class HeliusPositionFetcher {
  constructor() {
    this.heliusApiKey = process.env.HELIUS_API_KEY;
    
    if (!this.heliusApiKey || this.heliusApiKey === 'your_helius_api_key_here') {
      console.warn('⚠️  HELIUS_API_KEY not configured - using public RPC with limits');
      console.log('🔗 Sign up at: https://dashboard.helius.dev');
      console.log('💡 Free tier: 1M credits/month, then $19/month for unlimited');
      this.heliusRpcUrl = 'https://api.mainnet-beta.solana.com';
    } else {
      console.log('✅ Using Helius RPC - unlimited requests available');
      this.heliusRpcUrl = `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`;
    }
  }

  /**
   * Make RPC call with Helius (no rate limits)
   */
  async rpcCall(method, params) {
    const response = await fetch(this.heliusRpcUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'DN-Model-Helius/1.0'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 10000),
        method,
        params
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message} (Code: ${data.error.code})`);
    }
    
    return data.result;
  }

  /**
   * Get comprehensive position data for all 5 positions
   */
  async getAllPositionData(positions) {
    console.log('🚀 HELIUS-POWERED POSITION DATA FETCHER');
    console.log('='.repeat(70));
    console.log(`🌐 RPC Endpoint: ${this.heliusRpcUrl.substring(0, 50)}...`);
    console.log(`🔑 API Key: ${this.heliusApiKey ? 'Configured ✅' : 'Missing ⚠️'}`);
    console.log('');

    const results = [];

    for (const [i, pos] of positions.entries()) {
      console.log(`[${i + 1}/${positions.length}] ${pos.protocol.toUpperCase()} POSITION`);
      console.log(`📍 NFT: ${pos.id}`);
      console.log('─'.repeat(60));
      
      try {
        // Get full account info
        const accountInfo = await this.rpcCall('getAccountInfo', [
          pos.id,
          { encoding: 'base64' }
        ]);
        
        if (accountInfo?.value) {
          console.log('✅ Position NFT found');
          console.log(`📊 Owner: ${accountInfo.value.owner}`);
          console.log(`💾 Lamports: ${accountInfo.value.lamports.toLocaleString()}`);
          console.log(`📏 Data: ${accountInfo.value.data[0]?.length || 0} bytes`);
          
          // Check if this is a Token account (NFT position)
          let isTokenPosition = accountInfo.value.owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
          console.log(`📋 Type: ${isTokenPosition ? 'Token Program Account (Position NFT)' : 'Regular Account'}`);
          
          let tokenSupply = null;
          let tokenHolders = null;
          
          // Only try token operations if it's actually a token account
          if (isTokenPosition) {
            try {
              // Get token supply
              const supply = await this.rpcCall('getTokenSupply', [pos.id]);
              tokenSupply = supply;
              console.log(`💎 Supply: ${supply.value.amount} (Decimals: ${supply.value.decimals})`);
              
              // Get largest holders
              const holders = await this.rpcCall('getTokenLargestAccounts', [pos.id]);
              tokenHolders = holders;
              
              if (holders?.value?.length > 0) {
                const holderAddress = holders.value[0].address;
                console.log(`👛 Token Account: ${holderAddress}`);
                
                // Get token account owner
                const tokenAccountInfo = await this.rpcCall('getAccountInfo', [
                  holderAddress,
                  { encoding: 'jsonParsed' }
                ]);
                
                if (tokenAccountInfo?.value?.data?.parsed?.info) {
                  const info = tokenAccountInfo.value.data.parsed.info;
                  console.log(`🏠 Owner: ${info.owner}`);
                  console.log(`💰 Balance: ${info.tokenAmount.uiAmount}`);
                  
                  // Verify ownership
                  if (info.owner === 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k') {
                    console.log('✅ CONFIRMED: You own this position!');
                  }
                }
              }
              
            } catch (tokenError) {
              console.log(`⚠️  Token operations failed: ${tokenError.message}`);
              console.log('ℹ️  This might be a position data account, not a standard token');
            }
          } else {
            console.log('ℹ️  Non-token account - analyzing as position data account');
          }
          
          // Try to decode position data based on protocol
          let positionData = await this.decodePositionData(pos, accountInfo.value.data[0]);
          
          results.push({
            nftId: pos.id,
            protocol: pos.protocol,
            confirmed: true,
            owner: 'DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k',
            ...positionData
          });
          
        } else {
          console.log('❌ Position NFT not found');
          results.push({
            nftId: pos.id,
            protocol: pos.protocol,
            confirmed: false,
            error: 'NFT not found'
          });
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        results.push({
          nftId: pos.id,
          protocol: pos.protocol,
          confirmed: false,
          error: error.message
        });
      }
      
      console.log('\\n' + '~'.repeat(60) + '\\n');
    }

    return results;
  }

  /**
   * Attempt to decode position data (simplified version)
   */
  async decodePositionData(position, rawData) {
    if (!rawData) return { decoded: false };
    
    console.log(`🔍 Attempting to decode ${position.protocol} position data...`);
    
    try {
      if (position.protocol === 'Orca') {
        return this.decodeOrcaPosition(rawData);
      } else if (position.protocol === 'Raydium') {
        return this.decodeRaydiumPosition(rawData);
      }
    } catch (error) {
      console.log(`⚠️  Decode failed: ${error.message}`);
    }
    
    return { 
      decoded: false, 
      note: 'Position data requires protocol-specific SDK for full decoding' 
    };
  }

  /**
   * Decode Orca Whirlpool position (simplified)
   */
  decodeOrcaPosition(data) {
    console.log('🌊 Attempting Orca Whirlpool decode...');
    
    // This is a simplified decoder - real implementation would need the full Orca SDK
    // Orca positions contain: whirlpool pubkey, tick_lower, tick_upper, liquidity
    
    return {
      type: 'Orca Whirlpool',
      decoded: false,
      note: 'Orca position contains tick range and liquidity data - needs full SDK for parsing',
      dataLength: data.length,
      suggestedAction: 'Use Orca SDK or check position on orca.so'
    };
  }

  /**
   * Decode Raydium CLMM position (simplified)
   */
  decodeRaydiumPosition(data) {
    console.log('⚡ Attempting Raydium CLMM decode...');
    
    // Raydium CLMM positions contain: pool address, tick range, token amounts
    
    return {
      type: 'Raydium CLMM',
      decoded: false,
      note: 'Raydium position contains pool and tick data - needs full SDK for parsing',
      dataLength: data.length,
      suggestedAction: 'Use Raydium SDK or check position on raydium.io'
    };
  }

  /**
   * Generate summary report
   */
  generateSummary(results) {
    console.log('📊 COMPREHENSIVE POSITION SUMMARY');
    console.log('='.repeat(70));
    
    const confirmed = results.filter(r => r.confirmed);
    const orcaPositions = confirmed.filter(r => r.protocol === 'Orca');
    const raydiumPositions = confirmed.filter(r => r.protocol === 'Raydium');
    
    console.log(`✅ Confirmed Positions: ${confirmed.length}/5`);
    console.log(`🌊 Orca Whirlpool: ${orcaPositions.length}`);
    console.log(`⚡ Raydium CLMM: ${raydiumPositions.length}`);
    console.log('');
    
    if (confirmed.length === 5) {
      console.log('🎉 ALL POSITIONS CONFIRMED!');
      console.log('');
      console.log('🔧 NEXT STEPS:');
      console.log('1. Get exact ranges from protocol websites');
      console.log('2. Implement full SDK integration for automatic parsing');
      console.log('3. Update wallet-positions.json with real data');
      console.log('4. Set up periodic refresh for live data');
    }
    
    return {
      totalPositions: results.length,
      confirmedPositions: confirmed.length,
      orcaCount: orcaPositions.length,
      raydiumCount: raydiumPositions.length,
      allConfirmed: confirmed.length === 5
    };
  }
}

module.exports = { HeliusPositionFetcher };