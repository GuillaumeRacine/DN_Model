import { NextRequest, NextResponse } from 'next/server';
import { zerionAPI } from '../../../lib/zerion-api';

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Zerion Portfolio API called');
    
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('wallet') || '0x862f26238d773Fde4E29156f3Bb7CF58eA4cD1af';
    const type = searchParams.get('type') || 'positions'; // 'positions' | 'summary' | 'defi' | 'transactions'
    
    let data;
    
    switch (type) {
      case 'summary':
        console.log('📊 Fetching portfolio summary...');
        data = await zerionAPI.getPortfolioSummary(walletAddress);
        break;
        
      case 'defi':
        console.log('🏦 Fetching DeFi positions...');
        data = await zerionAPI.getDeFiPositions(walletAddress);
        break;
        
      case 'transactions':
        console.log('📋 Fetching transactions...');
        data = await zerionAPI.getWalletTransactions(walletAddress);
        break;
        
      case 'positions':
      default:
        console.log('💼 Fetching all positions...');
        data = await zerionAPI.getWalletPositions(walletAddress);
        break;
    }
    
    console.log('✅ Zerion data fetched successfully');
    
    return NextResponse.json({
      success: true,
      wallet: walletAddress,
      type: type,
      data: data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Zerion Portfolio API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('authorization');
    const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('rate limit');
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      type: isAuthError ? 'auth_error' : isRateLimitError ? 'rate_limit' : 'api_error',
      timestamp: new Date().toISOString()
    }, { 
      status: isAuthError ? 401 : isRateLimitError ? 429 : 500 
    });
  }
}