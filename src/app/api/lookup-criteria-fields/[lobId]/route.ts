import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET(
  request: Request,
  context: { params: { lobId: string } }
) {
  const { lobId } = context.params;

  try {
    const result = await executeQuery<Array<{
      ID: string;
      FIELD_NAME: string;
      DISPLAY_NAME: string;
      FIELD_TYPE: string;
    }>>(
      `SELECT ID, FIELD_NAME, DISPLAY_NAME, FIELD_TYPE 
       FROM ODER_LOOKUP_CRITERIA_FIELDS 
       WHERE LOB_ID = :lobId 
       ORDER BY DISPLAY_NAME`,
      [lobId],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: true,
        cacheTTL: 6 * 60 * 60 * 1000 // 6 hour cache
      }
    );

    const serializedRows = result.map(row => ({
      id: row.ID.toString(),
      fieldName: row.FIELD_NAME,
      displayName: row.DISPLAY_NAME,
      fieldType: row.FIELD_TYPE
    }));

    return NextResponse.json(serializedRows);
  } catch (error) {
    console.error('Error fetching lookup criteria fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lookup criteria fields' },
      { status: 500 }
    );
  }
}