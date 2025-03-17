import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET(
  request: Request,
  context: { params: { fieldId: string } }
) {
  const { fieldId } = context.params;

  try {
    const result = await executeQuery<Array<{
      FIELD_VALUE: string;
    }>>(
      `SELECT FIELD_VALUE 
       FROM ODER_LOOKUP_CRITERIA_VALUES 
       WHERE FIELD_ID = :fieldId 
       ORDER BY FIELD_VALUE`,
      [fieldId],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: true,
        cacheTTL: 6 * 60 * 60 * 1000 // 6 hour cache
      }
    );

    const serializedRows = result.map(row => ({
      value: row.FIELD_VALUE.toString()
    }));

    return NextResponse.json(serializedRows);
  } catch (error) {
    console.error('Error fetching lookup criteria values:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lookup criteria values' },
      { status: 500 }
    );
  }
}