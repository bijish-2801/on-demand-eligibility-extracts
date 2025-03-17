import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET() {
  try {
    const query = `
      SELECT 
        ID as id,
        DELIMITER_NAME as name
      FROM ODER_FILE_DELIMITERS
      ORDER BY DELIMITER_NAME
    `;


    const results = await executeQuery(query)
/*
    const results = await executeQuery(query, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        "ID": { type: oracledb.STRING },
        "DELIMITER_NAME": { type: oracledb.STRING }
      }
    });
*/

    // Transform response to ensure correct casing
    const transformedResults = results.map((row: any) => ({
      id: row.ID || row.id,
      name: row.DELIMITER_NAME || row.name || row.NAME
    }));


    return NextResponse.json(transformedResults);
  } catch (error) {
    console.error('Error fetching file delimiters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file delimiters' },
      { status: 500 }
    );
  }
}