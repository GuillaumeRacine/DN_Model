# Moralis API Integration for DN_Model

Complete integration guide for Moralis API to discover LP tokens and positions across multiple chains.

## 🎯 Overview

The Moralis integration adds powerful multi-chain LP token discovery capabilities to DN_Model, complementing the existing position tracking system with automated detection of liquidity positions across Base, Ethereum, Arbitrum, and other EVM chains.

## 🌐 Supported Chains & Protocols

### **EVM Chains**
- **Base**: Aerodrome Finance, Uniswap V3, other DEX protocols
- **Ethereum**: Uniswap V3, Sushiswap, Balancer, and 100+ protocols
- **Arbitrum**: GMX, Camelot, Uniswap V3, Balancer, and other major DEXs
- **Polygon**: QuickSwap, SushiSwap, Uniswap V3

### **Position Types Detected**
1. **ERC-20 LP Tokens** - Traditional liquidity pool tokens
2. **NFT Positions** - Uniswap V3, Aerodrome concentrated liquidity positions
3. **DeFi Positions** - Staking, farming, lending positions with liquidity components

## 📁 Implementation Files

### **Core API Integration** (`lib/moralis-api.ts`)
```typescript
// Main Moralis API class with methods for:
moralisAPI.getWalletTokenBalances(address, chainId)  // Get ERC-20 tokens
moralisAPI.getWalletNFTs(address, chainId)           // Get NFT positions  
moralisAPI.getWalletDeFiPositions(address, chainId)  // Get DeFi positions
moralisAPI.getSolanaTokenBalances(address)           // Solana tokens (fallback)
moralisAPI.filterLPTokens(tokens)                    // Filter for LP tokens
moralisAPI.filterLPNFTs(nfts)                        // Filter for LP NFTs
```

### **UI Component** (`components/MoralisPositionFinder.tsx`)
- Interactive position discovery interface
- Real-time scanning across multiple chains
- Detailed position information display
- Integration with existing position tracking

### **Integration Point** (`components/CLMPositionDashboard.tsx`)
- Added Moralis position finders to CLM dashboard
- Separate scanners for EVM and Solana chains
- Callback system for found positions

## 🔧 Configuration

### **Environment Variables**
```bash
# Moralis API Key (already configured)
MORALIS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Wallet addresses for scanning
EVM_WALLET=0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af
SOLANA_WALLET=DKGQ3gqfq2DpwkKZyazjMY1c1vKjzoX1A9jFrhVnzA3k
```

### **Chain Configuration**
```typescript
export const MORALIS_CHAINS = {
  BASE: '0x2105',        // Base mainnet
  ETHEREUM: '0x1',       // Ethereum mainnet  
  ARBITRUM: '0xa4b1',    // Arbitrum One
  POLYGON: '0x89',       // Polygon mainnet
  SOLANA: 'solana',      // Solana mainnet
} as const;
```

## 🚀 Usage Guide

### **1. Automatic Discovery**
The Moralis position finders are integrated into the CLM Position Dashboard:
- Navigate to **DN Model** tab
- Scroll to "🔍 Discover Additional LP Positions with Moralis"
- Click **🔍 Scan LP Positions** for EVM or Solana

### **2. Manual Integration**
```typescript
import { moralisHelpers } from '../lib/moralis-api';

// Scan all EVM chains for LP positions
const evmPositions = await moralisHelpers.getAllLPPositions(walletAddress);

// Scan Solana for LP tokens  
const solanaPositions = await moralisHelpers.getSolanaLPPositions(walletAddress);
```

### **3. Position Filtering**
```typescript
// Filter ERC-20 tokens for LP tokens
const lpTokens = moralisAPI.filterLPTokens(allTokens);

// Filter NFTs for LP position NFTs
const lpNFTs = moralisAPI.filterLPNFTs(allNFTs);
```

## 📊 Data Structure

### **Discovered Position Format**
```typescript
interface MoralisPosition {
  type: 'TOKEN' | 'NFT' | 'DEFI';
  chain: string;                    // Chain name
  protocol?: string;                // Protocol name (Uniswap V3, Aerodrome, etc.)
  tokenAddress: string;             // Contract address
  symbol: string;                   // Token symbol
  name: string;                     // Token/Position name
  balance?: string;                 // Token balance
  usdValue?: number;                // USD value if available
  tokenId?: string;                 // NFT token ID for position NFTs
  metadata?: any;                   // NFT metadata
  possibleLP: boolean;              // Filtered as potential LP position
}
```

### **Scan Results**
```typescript
interface ScanSummary {
  totalTokens: number;              // Total tokens found
  potentialLPs: number;             // Potential LP tokens
  nftPositions: number;             // NFT positions found
  defiPositions: number;            // DeFi positions found
  chainsCovered: string[];          // Chains successfully scanned
}
```

## 🎯 LP Detection Logic

### **ERC-20 LP Token Detection**
Filters tokens based on:
- Name contains: 'liquidity', 'lp token', 'uniswap', 'aerodrome', 'pancake'
- Symbol contains: '-lp', 'lp-', 'uni-v', 'slp'
- Symbol structure: Contains '/' or '-' (token pairs)
- Not native tokens

### **NFT LP Position Detection**  
Filters NFTs based on:
- Name contains: 'uniswap', 'position', 'aerodrome'
- Symbol contains: 'uni-v3', 'aero'
- Known LP NFT contracts:
  - `0xc36442b4a4522e871399cd717abdd847ab11fe88`: Uniswap V3 Position Manager
  - `0x827922686190790b37229fd06084350e74485b72`: Aerodrome Position Manager

### **DeFi Position Detection**
Identifies positions with:
- Position type: 'liquidity'
- Protocol integration with liquidity provision
- USD value calculation

## 🔄 Caching & Performance

### **Intelligent Caching**
- **Cache Duration**: 60 minutes TTL
- **Cache Keys**: Chain and wallet-specific
- **Cache Source Tracking**: 'Moralis EVM API', 'Moralis Solana API', etc.
- **Automatic Cleanup**: Expired entries removed every 10 minutes

### **Performance Optimizations**
- Parallel API calls for multiple chains
- Request batching where possible
- Graceful fallbacks for failed requests
- Rate limit awareness

## 🧪 Testing

### **API Connectivity Test**
```bash
# Test basic Moralis API connectivity
node scripts/simple-moralis-test.js
```

### **Comprehensive Integration Test**
```bash  
# Test full LP position discovery
node scripts/test-moralis-integration.js
```

### **Live Testing**
```bash
# Start development server
npm run dev

# Navigate to http://localhost:3001
# Go to "DN Model" tab
# Test Moralis position finders
```

## 🔍 Expected Results

### **Base Chain**
- **Aerodrome Positions**: NFT-based concentrated liquidity positions
- **Uniswap V3**: V3 position NFTs if available
- **LP Tokens**: Traditional ERC-20 LP tokens from various DEXs

### **Ethereum**
- **Uniswap V3 Positions**: Large number of V3 position NFTs
- **Legacy LP Tokens**: Uniswap V2, SushiSwap, Balancer LP tokens
- **Complex DeFi**: Compound, Aave, Curve positions with liquidity

### **Arbitrum**
- **GMX Positions**: GLM, GLP tokens and positions
- **Camelot**: LP tokens and NFT positions  
- **Multi-DEX Coverage**: Positions across Arbitrum's DeFi ecosystem

## ⚠️ Known Limitations

### **Solana Integration**
- Moralis Solana API endpoint may not be available in all plans
- Falls back to existing Helius/Orca/Raydium integrations
- Solana LP detection uses existing proven methods

### **DeFi Position Detection**
- Some protocols may not be covered by Moralis DeFi API
- Complex staking/farming positions may require manual verification
- USD values depend on Moralis price data availability

### **Rate Limits**
- Moralis API has rate limits based on plan tier
- Caching reduces API calls significantly
- Multiple wallet scanning may hit limits quickly

## 🔮 Future Enhancements

### **Protocol-Specific Integration**
- Direct integration with major DEX APIs
- Protocol-native position calculation
- Historical position tracking

### **Advanced Filtering**
- Machine learning-based LP detection
- Protocol-specific position validation
- Cross-reference with known LP contracts

### **Real-time Updates**
- WebSocket connections for real-time position updates
- Push notifications for new positions
- Automatic position synchronization

## 📚 Related Documentation

- **Main Documentation**: `README.md`
- **API Endpoints**: `endpoints.md` 
- **Mathematical Models**: `math.md`
- **Technical Architecture**: `CLAUDE.md`
- **CETUS Integration**: `docs/CETUS_INTEGRATION.md`

---

**🎯 Result**: DN_Model now has comprehensive multi-chain LP position discovery capabilities, automatically detecting positions across Base, Ethereum, Arbitrum, and other major chains using the powerful Moralis API infrastructure.