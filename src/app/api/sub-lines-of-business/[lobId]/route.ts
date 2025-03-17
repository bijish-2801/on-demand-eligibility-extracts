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
    const result = await executeQuery<Array<{ ID: string; NAME: string }>>(
      'SELECT ID, NAME, PREFIX FROM ODER_SUB_LINES_OF_BUSINESS WHERE LOB_ID = :lobId ORDER BY NAME',
      [lobId],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: true,
        cacheTTL: 12 * 60 * 60 * 1000 // 12 hour cache for semi-static sub-LOB data
      }
    );

    const serializedRows = result.map(row => ({
      id: row.ID.toString(),
      name: row.NAME.toString(),
      prefix: row.PREFIX.toString(),
      lobId
    }));

    return NextResponse.json(serializedRows);
  } catch (error) {
    console.error('Error fetching sub lines of business:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub lines of business' },
      { status: 500 }
    );
  }
}