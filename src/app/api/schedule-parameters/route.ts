import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET() {
  try {
    const query = `
      SELECT 
        ID as id,
        FREQUENCY as name
      FROM ODER_SCHEDULE_PARAMETERS
      ORDER BY ID
    `;


    const results = await executeQuery(query)
/*
    const results = await executeQuery(query, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        "ID": { type: oracledb.STRING },
        "FREQUENCY": { type: oracledb.STRING }
      }
    });
*/

    // Transform response to ensure correct casing
    const transformedResults = results.map((row: any) => ({
      id: row.ID || row.id,
      name: row.FREQUENCY || row.name || row.NAME
    }));


    return NextResponse.json(transformedResults);
  } catch (error) {
    console.error('Error fetching schedule parameters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule parameters' },
      { status: 500 }
    );
  }
}