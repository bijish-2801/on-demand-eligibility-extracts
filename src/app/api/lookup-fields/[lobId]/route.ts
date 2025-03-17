import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET(
  request: Request,
  context: { params: { lobId: string } }
) {
  // Await the params
  const { lobId } = await context.params;

  try {
    const result = await executeQuery<Array<{ ID: string; DISPLAY_NAME: string }>>(
      'SELECT ID, DISPLAY_NAME FROM ODER_LOOKUP_SELECT_FIELDS WHERE LOB_ID = :lobId ORDER BY ID',
      [lobId],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: true,
        cacheTTL: 6 * 60 * 60 * 1000 // 6 hour cache for lookup fields
      }
    );

    const serializedRows = result.map(row => ({
      id: row.ID.toString(),
      name: row.DISPLAY_NAME.toString(),
      lobId
    }));

    return NextResponse.json(serializedRows);
  } catch (error) {
    console.error('Error fetching lookup fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lookup fields' },
      { status: 500 }
    );
  }
}