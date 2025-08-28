// Math validation utility to ensure data accuracy and prevent calculation errors
// CRITICAL: All USD values, position ranges, and calculations must be validated

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  value?: number;
}

interface PositionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  calculatedTvl?: number;
  priceRangeValid?: boolean;
}

// Token decimal precision mapping
export const TOKEN_DECIMALS: { [symbol: string]: number } = {
  'USDC': 6,
  'USDT': 6,
  'DAI': 18,
  'WETH': 18,
  'ETH': 18,
  'WBTC': 8,
  'BTC': 8,
  'cbBTC': 8,
  'SOL': 9,
  'AERO': 18,
  'ARB': 18,
  'MATIC': 18,
  'AVAX': 18,
};

// Realistic price ranges for major tokens (in USD)
export const PRICE_RANGES: { [symbol: string]: { min: number; max: number } } = {
  'BTC': { min: 15000, max: 200000 },
  'WBTC': { min: 15000, max: 200000 },
  'cbBTC': { min: 15000, max: 200000 },
  'ETH': { min: 800, max: 20000 },
  'WETH': { min: 800, max: 20000 },
  'SOL': { min: 8, max: 1000 },
  'ARB': { min: 0.3, max: 10 },
  'MATIC': { min: 0.3, max: 5 },
  'AVAX': { min: 8, max: 200 },
  'AERO': { min: 0.1, max: 50 },
  'USDC': { min: 0.95, max: 1.05 },
  'USDT': { min: 0.95, max: 1.05 },
  'DAI': { min: 0.95, max: 1.05 },
};

// Realistic APR ranges for different DeFi activities
export const APR_RANGES = {
  'Stablecoin LP': { min: 0, max: 50 },  // 0-50% for stablecoin pools
  'Volatile LP': { min: 0, max: 200 },   // 0-200% for volatile pairs
  'Staking': { min: 0, max: 100 },       // 0-100% for token staking
  'ALM': { min: 0, max: 500 },           // 0-500% for automated LM (can be high)
  'Lending': { min: 0, max: 30 },        // 0-30% for lending protocols
};

export class MathValidator {
  
  /**
   * Validate USD value for realism
   */
  static validateUSDValue(usdValue: number, context: string = ''): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for basic validity
    if (typeof usdValue !== 'number' || isNaN(usdValue)) {
      errors.push(`Invalid USD value: ${usdValue} ${context}`);
      return { isValid: false, errors, warnings };
    }

    // Check for negative values (usually invalid)
    if (usdValue < 0) {
      errors.push(`Negative USD value: $${usdValue} ${context}`);
    }

    // Check for unrealistically large values
    if (usdValue > 1e12) { // > $1 trillion
      errors.push(`Unrealistically large USD value: $${usdValue.toExponential(2)} ${context}`);
    }

    // Check for floating point precision errors
    const decimalPlaces = (usdValue.toString().split('.')[1] || '').length;
    if (decimalPlaces > 8) {
      warnings.push(`High precision USD value (${decimalPlaces} decimals): $${usdValue} ${context}`);
    }

    // Check for common calculation errors (like price × amount with wrong decimals)
    if (usdValue > 1e6 && usdValue % 1 !== 0 && usdValue.toString().includes('e+')) {
      warnings.push(`Possible decimal precision error in USD calculation: $${usdValue} ${context}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: usdValue
    };
  }

  /**
   * Validate token price against expected ranges
   */
  static validateTokenPrice(tokenSymbol: string, price: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Clean token symbol
    const cleanSymbol = tokenSymbol.replace(/^W/, '').replace(/^cb/, '').toUpperCase();
    const range = PRICE_RANGES[cleanSymbol] || PRICE_RANGES[tokenSymbol.toUpperCase()];

    if (!range) {
      warnings.push(`No price range defined for token: ${tokenSymbol}`);
      return { isValid: true, errors, warnings, value: price };
    }

    if (price < range.min || price > range.max) {
      errors.push(`${tokenSymbol} price $${price} outside expected range $${range.min}-$${range.max}`);
    }

    // Check for common price calculation errors
    if (price < 0.000001 && tokenSymbol !== 'SHIB') {
      errors.push(`Suspiciously small price for ${tokenSymbol}: $${price}`);
    }

    if (price > 1000000 && !['BTC', 'WBTC', 'cbBTC'].includes(cleanSymbol)) {
      errors.push(`Suspiciously large price for ${tokenSymbol}: $${price}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: price
    };
  }

  /**
   * Validate APR/yield percentage
   */
  static validateAPR(apr: number, activityType: string = 'Volatile LP'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof apr !== 'number' || isNaN(apr)) {
      errors.push(`Invalid APR value: ${apr}`);
      return { isValid: false, errors, warnings };
    }

    const range = APR_RANGES[activityType as keyof typeof APR_RANGES] || APR_RANGES['Volatile LP'];

    if (apr < range.min || apr > range.max) {
      if (apr > range.max) {
        if (apr > 1000) {
          errors.push(`Unrealistic APR: ${apr}% (over 1000%)`);
        } else {
          warnings.push(`High APR: ${apr}% for ${activityType} (max expected: ${range.max}%)`);
        }
      }
      if (apr < range.min) {
        warnings.push(`Low APR: ${apr}% for ${activityType}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: apr
    };
  }

  /**
   * Validate position price range
   */
  static validatePriceRange(priceLower: number, priceUpper: number, currentPrice: number, tokenPair: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validity checks
    if (priceLower >= priceUpper) {
      errors.push(`Invalid price range for ${tokenPair}: lower (${priceLower}) >= upper (${priceUpper})`);
    }

    if (priceLower <= 0 || priceUpper <= 0) {
      errors.push(`Invalid price range for ${tokenPair}: prices must be positive`);
    }

    // Check if current price is within range (for active positions)
    if (currentPrice > 0) {
      if (currentPrice < priceLower || currentPrice > priceUpper) {
        warnings.push(`Current price ${currentPrice} outside range ${priceLower}-${priceUpper} for ${tokenPair}`);
      }
    }

    // Check for extremely wide or narrow ranges
    const rangeRatio = priceUpper / priceLower;
    if (rangeRatio > 100) {
      warnings.push(`Very wide price range for ${tokenPair}: ${rangeRatio.toFixed(2)}x`);
    }
    if (rangeRatio < 1.01) {
      warnings.push(`Very narrow price range for ${tokenPair}: ${rangeRatio.toFixed(4)}x`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate entire position for mathematical consistency
   */
  static validatePosition(position: any): PositionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate TVL
    if (position.tvlUsd) {
      const tvlValidation = this.validateUSDValue(position.tvlUsd, `TVL for ${position.tokenPair || position.id}`);
      errors.push(...tvlValidation.errors);
      warnings.push(...tvlValidation.warnings);
    }

    // Validate APR
    if (position.apr) {
      const aprType = position.type === 'ALM' ? 'ALM' : 
                     position.tokenPair?.includes('USDC') && position.tokenPair?.includes('USDT') ? 'Stablecoin LP' : 'Volatile LP';
      const aprValidation = this.validateAPR(position.apr, aprType);
      errors.push(...aprValidation.errors);
      warnings.push(...aprValidation.warnings);
    }

    // Validate price range
    if (position.priceLower && position.priceUpper) {
      const rangeValidation = this.validatePriceRange(
        position.priceLower, 
        position.priceUpper, 
        position.currentPrice || 0,
        position.tokenPair || position.id
      );
      errors.push(...rangeValidation.errors);
      warnings.push(...rangeValidation.warnings);
    }

    // Validate token amounts vs TVL (if we have token prices)
    if (position.liquidity && position.tvlUsd && position.tokenPair) {
      const liquidityStr = position.liquidity.toString();
      
      // Parse token amounts from liquidity string (e.g., "24372.05 USDC + 0.24787 cbBTC")
      const tokenMatches = liquidityStr.match(/(\d+\.?\d*)\s*(\w+)/g);
      if (tokenMatches && tokenMatches.length === 2) {
        let calculatedTvl = 0;
        let hasValidPrices = true;

        tokenMatches.forEach((match: any) => {
          const [, amountStr, symbol] = match.match(/(\d+\.?\d*)\s*(\w+)/) || [];
          const amount = parseFloat(amountStr);
          
          // Use rough price estimates for common tokens
          const roughPrices: { [key: string]: number } = {
            'USDC': 1, 'USDT': 1, 'DAI': 1,
            'WETH': 3500, 'ETH': 3500,
            'WBTC': 67000, 'cbBTC': 67000, 'BTC': 67000,
            'SOL': 140, 'ARB': 0.7, 'AERO': 1.2
          };

          const estimatedPrice = roughPrices[symbol] || roughPrices[symbol.replace(/^W/, '').replace(/^cb/, '')];
          if (estimatedPrice) {
            calculatedTvl += amount * estimatedPrice;
          } else {
            hasValidPrices = false;
          }
        });

        if (hasValidPrices && calculatedTvl > 0) {
          const tvlDifference = Math.abs(calculatedTvl - position.tvlUsd) / position.tvlUsd;
          if (tvlDifference > 0.5) { // 50% difference threshold
            warnings.push(`Large TVL discrepancy for ${position.tokenPair}: calculated $${calculatedTvl.toFixed(2)} vs reported $${position.tvlUsd.toFixed(2)}`);
          }
        }
      }
    }

    // Validate that position is marked as confirmed if it has real data
    if (position.tvlUsd && position.tvlUsd > 0 && !position.confirmed) {
      warnings.push(`Position ${position.id} has TVL but not marked as confirmed`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate array of positions
   */
  static validatePositions(positions: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalTvl = 0;

    positions.forEach((position, index) => {
      const positionValidation = this.validatePosition(position);
      
      // Prefix errors/warnings with position identifier
      const positionId = position.id || position.tokenPair || `Position ${index}`;
      errors.push(...positionValidation.errors.map(err => `${positionId}: ${err}`));
      warnings.push(...positionValidation.warnings.map(warn => `${positionId}: ${warn}`));

      if (position.tvlUsd && position.tvlUsd > 0) {
        totalTvl += position.tvlUsd;
      }
    });

    // Validate total TVL makes sense
    if (totalTvl > 1e9) { // > $1 billion
      warnings.push(`Very high total TVL: $${(totalTvl / 1e6).toFixed(1)}M`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      value: totalTvl
    };
  }

  /**
   * Log validation results to console with appropriate severity
   */
  static logValidationResults(validation: ValidationResult | PositionValidationResult, context: string = '') {
    const prefix = context ? `[${context}] ` : '';
    
    if (validation.errors.length > 0) {
      console.error(`${prefix}❌ Validation Errors:`, validation.errors);
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`${prefix}⚠️ Validation Warnings:`, validation.warnings);
    }

    if (validation.isValid && validation.errors.length === 0 && validation.warnings.length === 0) {
      console.log(`${prefix}✅ Validation passed`);
    }
  }
}

export default MathValidator;