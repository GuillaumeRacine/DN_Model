import { NextResponse } from 'next/server';
import { dataCache } from '../../../lib/data-cache';

export async function GET() {
  try {
    const cacheMetadata = dataCache.getAllMetadata();
    const latestRefresh = dataCache.getLatestRefreshTime();
    
    const summary = {
      timestamp: new Date().toISOString(),
      latestRefreshTime: latestRefresh?.toISOString() || null,
      totalCacheEntries: Object.keys(cacheMetadata).length,
      cacheDetails: cacheMetadata,
      systemStatus: {
        cacheActive: Object.keys(cacheMetadata).length > 0,
        hasRecentData: latestRefresh ? (Date.now() - latestRefresh.getTime()) < (60 * 60 * 1000) : false,
        nextExpiry: Object.values(cacheMetadata).length > 0 ? 
          Math.min(...Object.values(cacheMetadata).map(m => m.timeToExpiry)) : null
      }
    };
    
    return NextResponse.json(summary);
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get cache status',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}