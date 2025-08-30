// API endpoint for pool analytics data
import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

interface PoolAnalytics {
  pool_address: string;
  network: string;
  token_pair: string;
  tvl_usd: number | null;
  volatility_30d: number | null;
  fvr: number | null;
  recommendation: string | null;
  il_risk_score: number | null;
  last_updated: string;
  protocol: string;
  apy_base: number | null;
  data_points_count: number | null;
}

interface APIResponse {
  success: boolean;
  data?: PoolAnalytics[];
  error?: string;
  timestamp: string;
  total?: number;
}

// Open analytics database connection
async function getAnalyticsDB() {
  const dbPath = path.join(process.cwd(), 'analytics', 'database', 'analytics.db');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  
  return db;
}

// Get real pool analytics from database
async function getPoolAnalytics(params: {
  limit?: number;
  minTVL?: number;
  network?: string;
  sortBy?: 'fvr' | 'tvl' | 'volatility';
  orderBy?: 'asc' | 'desc';
}): Promise<PoolAnalytics[]> {
  
  const db = await getAnalyticsDB();
  
  try {
    // Build SQL query with filters
    let whereClause = 'WHERE pa.fvr IS NOT NULL';
    const queryParams: any[] = [];
    
    if (params.minTVL) {
      whereClause += ' AND pa.tvl_usd >= ?';
      queryParams.push(params.minTVL);
    }
    
    if (params.network) {
      whereClause += ' AND pa.network = ?';
      queryParams.push(params.network);
    }
    
    // Build ORDER BY clause
    let orderClause = '';
    if (params.sortBy) {
      const columnMap = {
        'fvr': 'pa.fvr',
        'tvl': 'pa.tvl_usd', 
        'volatility': 'pa.volatility_30d'
      };
      
      const column = columnMap[params.sortBy] || 'pa.fvr';
      const direction = params.orderBy === 'asc' ? 'ASC' : 'DESC';
      orderClause = `ORDER BY ${column} ${direction}`;
    } else {
      orderClause = 'ORDER BY pa.fvr DESC';
    }
    
    // Build LIMIT clause
    const limitClause = params.limit ? `LIMIT ${params.limit}` : 'LIMIT 100';
    
    const query = `
      SELECT 
        pa.pool_address,
        pa.network,
        pa.token_pair,
        pa.tvl_usd,
        pa.volume_24h,
        pa.apy_base,
        pa.volatility_30d,
        pa.fvr,
        pa.il_risk_score,
        pa.recommendation,
        pa.data_points_count,
        pa.last_updated,
        p.protocol
      FROM pool_analytics pa
      LEFT JOIN pools p ON pa.pool_address = p.pool_address
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;
    
    console.log('🔍 Executing analytics query:', query);
    console.log('📊 Query params:', queryParams);
    
    const rows = await db.all(query, queryParams);
    
    await db.close();
    
    return rows.map(row => ({
      pool_address: row.pool_address,
      network: row.network,
      token_pair: row.token_pair,
      tvl_usd: row.tvl_usd,
      volatility_30d: row.volatility_30d,
      fvr: row.fvr,
      recommendation: row.recommendation,
      il_risk_score: row.il_risk_score,
      last_updated: row.last_updated || new Date().toISOString(),
      protocol: row.protocol,
      apy_base: row.apy_base,
      data_points_count: row.data_points_count
    }));
    
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const minTVL = searchParams.get('minTVL') ? parseFloat(searchParams.get('minTVL')!) : 1000000;
    const network = searchParams.get('network') || undefined;
    const sortBy = (searchParams.get('sortBy') as 'fvr' | 'tvl' | 'volatility') || 'fvr';
    const orderBy = (searchParams.get('orderBy') as 'asc' | 'desc') || 'desc';

    console.log('🔍 Pool analytics request:', { limit, minTVL, network, sortBy, orderBy });

    const data = await getPoolAnalytics({
      limit,
      minTVL,
      network,
      sortBy,
      orderBy
    });

    const response: APIResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      total: data.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Pool analytics API error:', error);

    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// POST endpoint for updating user positions (tier assignments)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pool_address, network, position_type } = body;

    if (!pool_address || !network || !position_type) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: pool_address, network, position_type'
      }, { status: 400 });
    }

    // TODO: Implement database update for user positions
    console.log('📝 Position update request:', { pool_address, network, position_type });

    // Placeholder response
    return NextResponse.json({
      success: true,
      message: 'Position updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Position update error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}