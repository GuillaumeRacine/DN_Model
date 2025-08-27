import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || 'arbitrum';
    
    // Validate chain parameter
    if (!['arbitrum', 'avalanche'].includes(chain)) {
      return NextResponse.json({ error: 'Invalid chain parameter' }, { status: 400 });
    }
    
    const apiUrl = `https://gmx-integration-cg.vercel.app/api/${chain}/pairs`;
    
    console.log(`Fetching GMX data for ${chain}...`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      // Add timeout
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      throw new Error(`GMX API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate that data is an array
    if (!Array.isArray(data)) {
      throw new Error('GMX API returned invalid data format');
    }
    
    console.log(`Successfully fetched ${data.length} pairs for ${chain}`);
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('GMX API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GMX data', message: error.message },
      { status: 500 }
    );
  }
}