import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET() {
  try {
    // Use executeQuery with caching enabled and a longer TTL since LOB data changes infrequently
    const result = await executeQuery<Array<{ ID: string; NAME: string; PREFIX: string; SOURCE_SYS_ID: string; }>>(
      'SELECT ID, NAME, PREFIX, SOURCE_SYS_ID FROM ODER_LINES_OF_BUSINESS ORDER BY NAME',
      [], // no params
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: true,
        cacheTTL: 24 * 60 * 60 * 1000 // 24 hours cache
      }
    );
    
    const serializedRows = result.map(row => ({
      id: row.ID.toString(),
      name: row.NAME.toString(),
      prefix: row.PREFIX.toString(),
      source_sys_id: row.SOURCE_SYS_ID.toString()
    }));
    
    return NextResponse.json(serializedRows);
  } catch (error) {
    console.error('Error fetching lines of business:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lines of business' }, 
      { status: 500 }
    );
  }
}