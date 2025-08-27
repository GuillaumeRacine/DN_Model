# CETUS Protocol Integration Guide

## Overview
This guide documents the CETUS SDK integration for extracting and converting concentrated liquidity positions on the SUI blockchain.

## Key Findings

### 1. Correct Decimal Configuration
CETUS uses **USDC(6) / SUI(8)** decimals for price calculations, not the standard SUI(9) decimals.

```javascript
const USDC_DECIMALS = 6;
const SUI_DECIMALS = 8; // Not 9!
```

### 2. Tick to Price Conversion Workflow

```javascript
// Step 1: Extract tick indices from position object
const tickLower = position.tick_lower_index.fields.bits;
const tickUpper = position.tick_upper_index.fields.bits;

// Step 2: Convert ticks to prices using CETUS SDK
const { TickMath } = require('@cetusprotocol/cetus-sui-clmm-sdk');
const priceLower = TickMath.tickIndexToPrice(tickLower, USDC_DECIMALS, SUI_DECIMALS);
const priceUpper = TickMath.tickIndexToPrice(tickUpper, USDC_DECIMALS, SUI_DECIMALS);
```

### 3. Verified Position Ranges

#### Position #1 (0x6c08a2dd...)
- **Tick Range:** 47220 → 61560
- **Price Range:** 1.12 → 4.71 USDC per SUI
- **Liquidity:** 819,643,734,525
- **Status:** ✅ In Range

#### Position #2 (0x8e58a0cc...)
- **Tick Range:** 53820 → 57120
- **Price Range:** 2.17 → 3.02 USDC per SUI
- **Liquidity:** 0 (no active liquidity)
- **Status:** ❌ Out of Range (current price ~3.49)

## Implementation Files

### Core Module
- `/lib/cetus-position-manager.js` - CETUS position manager with automatic detection

### Scripts
- `/scripts/proper-cetus-conversion.js` - Demonstrates correct tick conversion
- `/scripts/fetch-all-positions.js` - Unified position fetcher for all chains

### Dashboard
- `/components/CLMPositionDashboard.tsx` - Updated with CETUS price ranges

## Key Methods

### Get Position Data
```javascript
const cetusManager = new CetusPositionManager();
const positions = await cetusManager.getWalletPositions(walletAddress);
```

### Convert Ticks to Prices
```javascript
const priceRange = cetusManager.convertTicksToPrice(
  tickLower,
  tickUpper,
  decimalsA,
  decimalsB,
  isInverted
);
```

## SUI RPC Configuration
- **Endpoint:** `https://fullnode.mainnet.sui.io:443`
- **Methods:** `sui_getObject` with `showContent: true`

## Common Issues & Solutions

### Issue: Prices 100x Too High
**Solution:** Use USDC(6)/SUI(8) decimals instead of standard SUI(9)

### Issue: Token Pair Order
**Solution:** Check if inversion needed based on token types in pool

### Issue: Position Out of Range
**Solution:** Compare current pool price with position price bounds

## Future Improvements
1. Implement real-time price updates from pool
2. Add support for other CETUS trading pairs
3. Automate position rebalancing alerts
4. Integrate with CETUS SDK for position management

## Resources
- [CETUS Documentation](https://cetus-1.gitbook.io/cetus-docs)
- [CETUS Developer Docs](https://cetus-1.gitbook.io/cetus-developer-docs)
- [CETUS SDK](https://www.npmjs.com/package/@cetusprotocol/cetus-sui-clmm-sdk)