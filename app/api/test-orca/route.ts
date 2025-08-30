import { NextResponse } from 'next/server';
import { accurateOrcaFetcher } from '../../../lib/accurate-orca-fetcher';

export async function GET() {
  try {
    console.log('🧪 API: Testing Orca fetcher...');
    
    const positions = await accurateOrcaFetcher.getAccuratePositions();
    
    console.log(`📊 API: Found ${positions.length} positions`);
    
    if (positions.length > 0) {
      console.log('🎯 API: First position:', positions[0]);
    }
    
    return NextResponse.json({
      success: true,
      count: positions.length,
      positions: positions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ API: Error testing Orca fetcher:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}