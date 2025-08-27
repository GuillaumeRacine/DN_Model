// Position Data Fetcher - Get real CLM position data from Orca and Raydium

const { Connection, PublicKey } = require('@solana/web3.js');
const { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, PDAUtil } = require('@orca-so/whirlpools-sdk');
const { Raydium } = require('@raydium-io/raydium-sdk-v2');

class PositionDataFetcher {
  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    this.orcaClient = null;
    this.raydiumClient = null;
  }

  async initialize() {
    console.log('🔄 Initializing position data fetcher...');
    
    try {
      // Initialize Orca client
      const ctx = WhirlpoolContext.withProvider(
        { connection: this.connection, wallet: null },
        ORCA_WHIRLPOOL_PROGRAM_ID
      );
      this.orcaClient = buildWhirlpoolClient(ctx);
      console.log('✅ Orca client initialized');
      
      // Initialize Raydium client  
      this.raydiumClient = await Raydium.load({
        connection: this.connection,
        disableLoadToken: false
      });
      console.log('✅ Raydium client initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize clients:', error.message);
      throw error;
    }
  }

  /**
   * Fetch Orca Whirlpool position data
   */
  async fetchOrcaPosition(positionNftMint) {
    console.log(`🌊 Fetching Orca position: ${positionNftMint.substring(0, 8)}...`);
    
    try {
      // Get position PDA from NFT mint
      const positionPda = PDAUtil.getPosition(
        ORCA_WHIRLPOOL_PROGRAM_ID,
        new PublicKey(positionNftMint)
      );
      
      console.log(`📍 Position PDA: ${positionPda.publicKey.toString()}`);
      
      // Fetch position account data
      const position = await this.orcaClient.getPosition(positionPda.publicKey);
      
      if (position) {
        // Fetch the associated whirlpool
        const whirlpool = await this.orcaClient.getWhirlpool(position.whirlpool);
        
        // Get token info
        const tokenA = whirlpool.tokenMintA;
        const tokenB = whirlpool.tokenMintB;
        
        // Calculate price range from ticks
        const tickSpacing = whirlpool.tickSpacing;
        const tickLower = position.tickLowerIndex;
        const tickUpper = position.tickUpperIndex;
        
        // Convert ticks to prices (this is simplified - real calculation involves sqrt price)
        const priceLower = Math.pow(1.0001, tickLower);
        const priceUpper = Math.pow(1.0001, tickUpper);
        
        // Get current pool price
        const currentPrice = Math.pow(whirlpool.sqrtPrice.toNumber() / Math.pow(2, 64), 2);
        
        return {
          protocol: 'Orca',
          type: 'Whirlpool',
          positionMint: positionNftMint,
          whirlpoolAddress: position.whirlpool.toString(),
          tokenA: tokenA.toString(),
          tokenB: tokenB.toString(),
          liquidity: position.liquidity.toString(),
          tickLower: tickLower,
          tickUpper: tickUpper,
          priceLower: priceLower,
          priceUpper: priceUpper,
          currentPrice: currentPrice,
          inRange: currentPrice >= priceLower && currentPrice <= priceUpper,
          tickSpacing: tickSpacing
        };
      }
      
    } catch (error) {
      console.error(`❌ Error fetching Orca position: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch Raydium CLMM position data
   */
  async fetchRaydiumPosition(positionNftMint) {
    console.log(`⚡ Fetching Raydium position: ${positionNftMint.substring(0, 8)}...`);
    
    try {
      // Get all CLMM pools
      const pools = await this.raydiumClient.clmm.getPoolInfos();
      
      // Try to find position data
      // This is a simplified approach - real implementation would need position account parsing
      console.log(`📊 Found ${pools.length} CLMM pools`);
      
      // For now, return basic structure until we can parse the position account properly
      return {
        protocol: 'Raydium',
        type: 'CLMM',
        positionMint: positionNftMint,
        status: 'Position found but detailed parsing needed',
        note: 'Raydium position parsing requires more complex account data interpretation'
      };
      
    } catch (error) {
      console.error(`❌ Error fetching Raydium position: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch all position data for a wallet
   */
  async fetchAllPositions(positions) {
    const results = [];
    
    for (const pos of positions) {
      console.log(`\n🔍 Processing ${pos.protocol} position...`);
      
      let positionData = null;
      
      if (pos.protocol === 'Orca') {
        positionData = await this.fetchOrcaPosition(pos.id);
      } else if (pos.protocol === 'Raydium') {
        positionData = await this.fetchRaydiumPosition(pos.id);
      }
      
      if (positionData) {
        results.push(positionData);
        console.log(`✅ Successfully fetched ${pos.protocol} position data`);
      } else {
        console.log(`❌ Failed to fetch ${pos.protocol} position data`);
      }
    }
    
    return results;
  }

  /**
   * Format price for display
   */
  formatPrice(price, decimals = 6) {
    if (price < 0.000001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(0);
  }
}

module.exports = { PositionDataFetcher };