import { NextResponse } from 'next/server';
import { apiHealthMonitor } from '../../../lib/api-config';

export async function GET() {
  try {
    const healthSummary = apiHealthMonitor.getHealthSummary();
    
    // Test a few critical endpoints
    const quickTests = await Promise.allSettled([
      // Test DeFiLlama free API
      fetch('https://api.llama.fi/protocols?simple=true', { 
        signal: AbortSignal.timeout(5000) 
      }).then(r => r.ok),
      
      // Test CoinGecko fallback
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
        signal: AbortSignal.timeout(5000)
      }).then(r => r.ok),
      
      // Test Helius RPC
      fetch(process.env.HELIUS_RPC_URL || '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
        signal: AbortSignal.timeout(5000)
      }).then(r => r.ok)
    ]);

    const liveStatus = {
      defiLlamaFree: quickTests[0].status === 'fulfilled' && quickTests[0].value,
      coingecko: quickTests[1].status === 'fulfilled' && quickTests[1].value,
      helius: quickTests[2].status === 'fulfilled' && quickTests[2].value
    };

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      summary: healthSummary,
      liveTests: liveStatus,
      recommendations: {
        immediate: [
          healthSummary.failingAPIs.length > 0 ? 'Review failing API credentials' : null,
          liveStatus.coingecko ? null : 'CoinGecko fallback may be rate limited'
        ].filter(Boolean),
        monitoring: [
          'Set up alerts for API response times > 5s',
          'Monitor data freshness for price feeds',
          'Track fallback usage frequency'
        ]
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      fallbacksAvailable: true
    }, { status: 500 });
  }
}