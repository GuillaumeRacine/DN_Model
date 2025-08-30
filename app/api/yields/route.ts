import { NextRequest, NextResponse } from 'next/server';
import { defiLlamaAPI } from '../../../lib/defillama-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minTVL = searchParams.get('minTVL') ? Number(searchParams.get('minTVL')) : 1_000_000;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 200;

    const data = await defiLlamaAPI.getYieldPools();
    const now = Date.now();

    const pools = (data?.data || [])
      .filter((p: any) => typeof p.apy === 'number' && p.apy >= 0 && p.apy < 1_000 && typeof p.tvlUsd === 'number' && p.tvlUsd >= minTVL)
      .slice(0, limit)
      .map((p: any) => ({
        pool: p.pool,
        symbol: p.symbol,
        project: p.project,
        chain: p.chain,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase ?? 0,
        apyReward: p.apyReward ?? 0,
        volumeUsd1d: p.volumeUsd1d ?? 0,
        volumeUsd7d: p.volumeUsd7d ?? 0,
        poolMeta: p.poolMeta,
        apyMean30d: p.apyMean30d,
        apyBaseInception: p.apyBaseInception,
        inception: p.inception,
        listedAt: p.listedAt,
        age: p.age,
        count: p.count, // This is the number of days of data available
        dataTimestamp: now
      }));

    return NextResponse.json({
      success: true,
      source: 'DeFiLlama Pro',
      updatedAt: new Date().toISOString(),
      total: pools.length,
      data: pools
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedAt: new Date().toISOString(),
      data: []
    }, { status: 500 });
  }
}

