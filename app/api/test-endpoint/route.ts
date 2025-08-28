import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    // Simple check for now - can be enhanced later
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 5000,
    });
    
    return NextResponse.json({
      ok: response.ok,
      status: response.status
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}