import { NextRequest, NextResponse } from 'next/server';
import { defiLlamaAPI } from '../../../lib/defillama-api';
import { dataCache } from '../../../lib/data-cache';

type AgeMap = Record<string, number>; // poolId -> days

async function getChartPoints(poolId: string): Promise<any[]> {
  try {
    const res = await defiLlamaAPI.getPoolChart(poolId);
    // Try common shapes
    const maybe = (res as any);
    if (Array.isArray(maybe)) return maybe;
    if (maybe && Array.isArray(maybe.data)) return maybe.data;
    if (maybe && Array.isArray((maybe as any).chart)) return (maybe as any).chart;
    if (maybe && maybe.data && Array.isArray(maybe.data.data)) return maybe.data.data;
    if (maybe && maybe.data && Array.isArray((maybe.data as any).chart)) return (maybe.data as any).chart;
    return [];
  } catch {
    return [];
  }
}

function daysSince(tsSeconds: number): number {
  return Math.max(1, Math.floor((Date.now() - (tsSeconds * 1000)) / (1000 * 60 * 60 * 24)));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);

    // Use cached map if present and covers all requested ids
    const cached = dataCache.get<AgeMap>('pool_ages');
    let ageMap: AgeMap = cached?.data || {};

    const toFetch = ids.filter(id => typeof ageMap[id] !== 'number' || ageMap[id] <= 0);

    for (const id of toFetch) {
      const points = await getChartPoints(id);
      if (Array.isArray(points) && points.length > 0) {
        const first = points[0];
        const ts = typeof first?.timestamp === 'number'
          ? first.timestamp
          : (typeof first?.t === 'number' ? first.t
          : (typeof first?.time === 'number' ? first.time
          : (typeof first?.date === 'number' ? first.date : null)));
        if (ts) {
          ageMap[id] = daysSince(ts);
          continue;
        }
      }
      // Fallback if no points: set to 0 (unknown)
      ageMap[id] = 0;
    }

    // Cache for 60 minutes
    dataCache.set('pool_ages', ageMap, 'DeFiLlama Pro');

    return NextResponse.json({ success: true, ages: ageMap, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
