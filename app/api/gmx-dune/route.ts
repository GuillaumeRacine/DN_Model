import { NextRequest, NextResponse } from 'next/server';
import { DuneClient } from '@duneanalytics/client-sdk';

// GMX V2 Market data query ID (the one we used before)
const GMX_V2_MARKETS_QUERY_ID = 3931240;

export async function GET(request: NextRequest) {
  try {
    // Check if Dune API key is configured
    const duneApiKey = process.env.DUNE_API_KEY;
    if (!duneApiKey) {
      return NextResponse.json({
        error: 'Dune API not configured',
        message: 'DUNE_API_KEY environment variable not set'
      }, { status: 503 });
    }

    console.log('Fetching GMX V2 data using Dune SDK...');
    
    // Initialize Dune client
    const dune = new DuneClient(duneApiKey);
    
    // Get latest results for the GMX V2 markets query
    const queryResult = await dune.getLatestResult({ 
      queryId: GMX_V2_MARKETS_QUERY_ID 
    });
    
    if (!queryResult || !queryResult.result || !queryResult.result.rows) {
      throw new Error('No data returned from Dune query');
    }

    const rows = queryResult.result.rows;
    console.log(`Successfully fetched ${rows.length} markets from Dune SDK`);
    
    // Filter for Arbitrum perpetuals only (swap_only = 0)
    const arbitrumPerpetuals = rows.filter((row: any) => 
      row.swap_only === 0 && row.chain === 'arbitrum'
    );
    
    console.log(`Filtered to ${arbitrumPerpetuals.length} Arbitrum perpetual markets`);
    
    return NextResponse.json({
      success: true,
      query_id: GMX_V2_MARKETS_QUERY_ID,
      execution_id: queryResult.execution_id,
      data: arbitrumPerpetuals,
      metadata: {
        total_markets: rows.length,
        arbitrum_perpetuals: arbitrumPerpetuals.length,
        columns: queryResult.result.metadata?.column_names || [],
        execution_time: queryResult.execution_time_ms
      }
    });
    
  } catch (error) {
    console.error('Dune SDK error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch GMX data via Dune SDK', 
        message: error.message 
      },
      { status: 500 }
    );
  }
}