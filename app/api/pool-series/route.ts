import { NextRequest, NextResponse } from 'next/server';
import { defiLlamaAPI } from '../../../lib/defillama-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool');
    if (!pool) {
      return NextResponse.json({ success: false, error: 'Missing pool id' }, { status: 400 });
    }

    const data = await defiLlamaAPI.getPoolChart(pool);
    return NextResponse.json({ success: true, pool, data, updatedAt: new Date().toISOString() });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null,
    }, { status: 500 });
  }
}

