import { NextRequest, NextResponse } from 'next/server';
import { fetchEthereumPositions } from '../../../lib/ethereum-positions';
import { accurateOrcaFetcher } from '../../../lib/accurate-orca-fetcher';

type NormalizedPosition = {
  id: string;
  chain: string;
  protocol: string;
  tokenPair: string;
  inRange: boolean | null;
  tvlUsd: number | null;
  priceLower?: number | null;
  priceUpper?: number | null;
  currentPrice?: number | null;
  poolShare?: number | null;
  pendingYieldUsd?: number | null;
  lastUpdated?: string;
  dataSource?: string;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet') || undefined;

    const positions: NormalizedPosition[] = [];

    // EVM/Base: Aerodrome positions
    try {
      const evmPositions = await fetchEthereumPositions(wallet);
      evmPositions.forEach((p) => {
        const deterministicId = p.poolAddress || p.tokenId || p.id;
        positions.push({
          id: deterministicId,
          chain: p.chain,
          protocol: p.protocol,
          tokenPair: p.tokenPair,
          inRange: p.inRange,
          tvlUsd: typeof p.tvlUsd === 'number' ? p.tvlUsd : null,
          priceLower: p.priceLower ?? null,
          priceUpper: p.priceUpper ?? null,
          currentPrice: p.currentPrice ?? null,
          poolShare: null,
          pendingYieldUsd: null,
          lastUpdated: p.lastUpdated?.toISOString?.() || undefined,
          dataSource: 'EVM RPC/Protocol'
        });
      });
    } catch (e) {
      // ignore but log server-side
      console.error('EVM positions fetch error:', e);
    }

    // Solana: Orca positions (feature-flagged)
    try {
      const orcaPositions = await accurateOrcaFetcher.getAccuratePositions();
      orcaPositions.forEach((p) => {
        const deterministicId = p.whirlpool || p.nftMint || p.id;
        positions.push({
          id: deterministicId,
          chain: p.chain,
          protocol: p.protocol,
          tokenPair: p.tokenPair,
          inRange: p.inRange,
          tvlUsd: p.tvlUsd,
          priceLower: p.priceLower,
          priceUpper: p.priceUpper,
          currentPrice: p.currentPrice,
          poolShare: p.poolShare ?? null,
          pendingYieldUsd: p.pendingYield ?? null,
          lastUpdated: p.lastUpdated?.toISOString?.(),
          dataSource: p.dataSource
        });
      });
    } catch (e) {
      console.error('Orca positions fetch error:', e);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      total: positions.length,
      positions
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
