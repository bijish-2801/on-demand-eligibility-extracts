// src/app/api/operators/route.ts
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fieldName = searchParams.get('fieldName');
    const lobId = searchParams.get('lobId');

    // If field name and LOB ID are provided, get specific operators
    if (fieldName && lobId) {
      const query = `
        SELECT ID, FIELD_TYPE, OPERATOR_SYMBOL 
        FROM ODER_OPERATORS 
        WHERE FIELD_TYPE = (
          SELECT FIELD_TYPE 
          FROM ODER_LOOKUP_CRITERIA_FIELDS 
          WHERE FIELD_NAME = :fieldName 
          AND LOB_ID = :lobId
        )
      `;

      const result = await executeQuery<Array<{ ID: number; FIELD_TYPE: string; OPERATOR_SYMBOL: string }>>(
        query,
        { fieldName, lobId },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          useCache: true,
          cacheTTL: 7 * 24 * 60 * 60 * 1000 // 7 day cache for static operator data
        }
      );

      const serializedRows = result.map(row => ({
        id: row.ID,
        field_type: row.FIELD_TYPE,
        operator_symbol: row.OPERATOR_SYMBOL
      }));

      return NextResponse.json(serializedRows);
    }

    // Return empty array if no parameters provided
    return NextResponse.json([]);
  } catch (error) {
    console.error('Error fetching operators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operators' },
      { status: 500 }
    );
  }
}