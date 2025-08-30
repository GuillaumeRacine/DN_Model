// Mathematical helper functions implementing formulas from math.md
// CLM position analytics and volatility calculations

/**
 * Calculate annualized volatility from returns (math.md Section 3)
 * @param {number[]} returns - Array of log returns
 * @param {string} frequency - 'hourly', 'daily', '15min'
 * @returns {number} Annualized volatility (decimal, not percentage)
 */
function calculateAnnualizedVolatility(returns, frequency = 'hourly') {
    if (!returns || returns.length < 2) return null;
    
    const frequencies = {
        'hourly': 24 * 365,      // 8760 observations per year
        'daily': 365,            // 365 observations per year
        '15min': 4 * 24 * 365,   // 35040 observations per year
        '5min': 12 * 24 * 365    // 105120 observations per year
    };
    
    const scalingFactor = frequencies[frequency];
    if (!scalingFactor) {
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
    
    // Calculate sample standard deviation
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const stddev = Math.sqrt(variance);
    
    // Annualize: σ_ann = σ_period × √(periods per year)
    return stddev * Math.sqrt(scalingFactor);
}

/**
 * Calculate Fee-to-Volatility Ratio (math.md Section 3)
 * @param {number} feeAPR - Annual fee APR (decimal, not percentage)
 * @param {number} volatility - Annualized volatility (decimal)
 * @returns {number} FVR ratio
 */
function calculateFVR(feeAPR, volatility) {
    if (volatility === 0 || volatility === null || volatility === undefined) return 0;
    if (feeAPR === null || feeAPR === undefined) return 0;
    
    return feeAPR / volatility;
}

/**
 * Classify FVR signal (math.md Section 7)
 * @param {number} fvr - Fee-to-Volatility Ratio
 * @returns {string} 'attractive', 'fair', or 'overpriced'
 */
function classifyFVR(fvr) {
    if (fvr > 1.0) return 'attractive';
    if (fvr > 0.6) return 'fair';
    return 'overpriced';
}

/**
 * Estimate Impermanent Loss for concentrated liquidity (math.md Section 4)
 * @param {number} priceRatio - P_end / P_start
 * @param {boolean} isConcentrated - Whether position is concentrated liquidity
 * @param {number} concentrationFactor - Multiplier for concentrated positions
 * @returns {number} Estimated IL (negative value)
 */
function estimateImpermanentLoss(priceRatio, isConcentrated = true, concentrationFactor = 1.5) {
    if (priceRatio <= 0) return 0;
    
    // Constant product formula: IL = (2√r)/(1+r) - 1
    const r = priceRatio;
    const ilCP = (2 * Math.sqrt(r)) / (1 + r) - 1;
    
    // Concentrated liquidity positions have higher IL risk
    if (isConcentrated) {
        return ilCP * concentrationFactor;
    }
    
    return ilCP;
}

/**
 * Calculate position value in token1 units (math.md Section 1)
 * @param {number} price - Current price P
 * @param {number} priceLower - Lower bound Pa
 * @param {number} priceUpper - Upper bound Pb
 * @param {number} liquidity - Liquidity parameter L
 * @returns {number} Position value in token1 units
 */
function calculatePositionValue(price, priceLower, priceUpper, liquidity) {
    const s = Math.sqrt(price);
    const sa = Math.sqrt(priceLower);
    const sb = Math.sqrt(priceUpper);
    
    // Piecewise calculation from math.md
    if (price <= priceLower) {
        // Only token0: V(P) = amount0 × P
        const amount0 = liquidity * (1/sa - 1/sb);
        return amount0 * price;
    } else if (price >= priceUpper) {
        // Only token1: V(P) = amount1
        return liquidity * (sb - sa);
    } else {
        // In range: V(P) = L(2s - sa - s²/sb)
        return liquidity * (2 * s - sa - (s * s) / sb);
    }
}

/**
 * Calculate 50/50 HODL value for comparison (math.md Section 4)
 * @param {number} initialCapital - Initial capital in token1 units
 * @param {number} currentPrice - Current price P
 * @param {number} initialPrice - Initial price P0
 * @returns {number} HODL value in token1 units
 */
function calculateHODLValue(initialCapital, currentPrice, initialPrice) {
    // V_HODL(P) = C0/2 × (1 + P/P0)
    return (initialCapital / 2) * (1 + currentPrice / initialPrice);
}

/**
 * Calculate pool-level Fee APR (math.md Section 2)
 * @param {number} fees24h - 24h fees in USD
 * @param {number} tvlUsd - TVL in USD
 * @returns {number} Annualized Fee APR (decimal)
 */
function calculatePoolFeeAPR(fees24h, tvlUsd) {
    if (tvlUsd === 0 || tvlUsd === null) return 0;
    if (fees24h === null || fees24h === undefined) return 0;
    
    return (fees24h / tvlUsd) * 365;
}

/**
 * Calculate position-specific Fee APR (math.md Section 2)
 * @param {number} poolFeeAPR - Pool-level fee APR
 * @param {number} timeInRange - Fraction of time in range (0-1)
 * @param {number} liquidityShare - Share of active liquidity (0-1)
 * @returns {number} Position Fee APR (decimal)
 */
function calculatePositionFeeAPR(poolFeeAPR, timeInRange = 1.0, liquidityShare = 1.0) {
    return poolFeeAPR * timeInRange * liquidityShare;
}

/**
 * Calculate expected IL rate from historical volatility
 * @param {number} volatility - Annualized volatility
 * @param {number} concentrationMultiplier - Multiplier for concentrated positions
 * @returns {number} Expected IL rate per year
 */
function calculateExpectedILRate(volatility, concentrationMultiplier = 1.5) {
    // Rough approximation: IL rate scales with volatility squared for concentrated positions
    // This is a simplified model - real implementation would use Monte Carlo simulation
    const baseILRate = volatility * volatility * 0.5; // Quadratic relationship
    return baseILRate * concentrationMultiplier;
}

/**
 * Calculate breakeven Fee APR (math.md Section 5)
 * @param {number} expectedILRate - Expected IL rate per year
 * @returns {number} Minimum Fee APR needed to break even
 */
function calculateBreakevenFeeAPR(expectedILRate) {
    return expectedILRate; // Simplified: fees need to cover expected IL
}

/**
 * Calculate excess yield (math.md Section 5)
 * @param {number} positionFeeAPR - Position Fee APR
 * @param {number} expectedILRate - Expected IL rate
 * @returns {number} Excess yield over IL
 */
function calculateExcessYield(positionFeeAPR, expectedILRate) {
    return positionFeeAPR - expectedILRate;
}

/**
 * Calculate log returns from price series
 * @param {number[]} prices - Array of prices
 * @returns {number[]} Array of log returns
 */
function calculateLogReturns(prices) {
    if (!prices || prices.length < 2) return [];
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > 0 && prices[i-1] > 0) {
            returns.push(Math.log(prices[i] / prices[i-1]));
        }
    }
    
    return returns;
}

/**
 * Calculate rolling volatility over multiple windows
 * @param {number[]} returns - Array of returns
 * @param {string} frequency - Data frequency
 * @returns {object} Volatility for different windows
 */
function calculateRollingVolatility(returns, frequency = 'hourly') {
    if (!returns || returns.length < 24) return null;
    
    const frequencies = {
        'hourly': { '1d': 24, '7d': 168, '30d': 720 },
        'daily': { '1d': 1, '7d': 7, '30d': 30 }
    };
    
    const windows = frequencies[frequency];
    if (!windows) return null;
    
    const result = {};
    
    for (const [period, windowSize] of Object.entries(windows)) {
        if (returns.length >= windowSize) {
            const windowReturns = returns.slice(-windowSize);
            result[period] = calculateAnnualizedVolatility(windowReturns, frequency);
        }
    }
    
    return result;
}

/**
 * Validate data quality for calculations
 * @param {number[]} data - Input data array
 * @param {string} type - Type of data ('prices', 'returns')
 * @returns {object} Validation results
 */
function validateDataQuality(data, type = 'prices') {
    if (!Array.isArray(data)) {
        return { valid: false, error: 'Data is not an array' };
    }
    
    if (data.length === 0) {
        return { valid: false, error: 'Empty data array' };
    }
    
    const validValues = data.filter(v => v !== null && v !== undefined && !isNaN(v));
    const validRatio = validValues.length / data.length;
    
    if (type === 'prices') {
        const positiveValues = validValues.filter(v => v > 0);
        if (positiveValues.length < validValues.length * 0.95) {
            return { 
                valid: false, 
                error: 'Too many non-positive price values',
                validRatio: positiveValues.length / data.length
            };
        }
    }
    
    return {
        valid: validRatio >= 0.9, // Require at least 90% valid data
        validRatio,
        totalPoints: data.length,
        validPoints: validValues.length,
        error: validRatio < 0.9 ? 'Insufficient valid data points' : null
    };
}

module.exports = {
    calculateAnnualizedVolatility,
    calculateFVR,
    classifyFVR,
    estimateImpermanentLoss,
    calculatePositionValue,
    calculateHODLValue,
    calculatePoolFeeAPR,
    calculatePositionFeeAPR,
    calculateExpectedILRate,
    calculateBreakevenFeeAPR,
    calculateExcessYield,
    calculateLogReturns,
    calculateRollingVolatility,
    validateDataQuality
};