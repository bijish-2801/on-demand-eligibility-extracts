import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET() {
  try {
    const query = `
      SELECT 
        ID as id,
        FORMAT_NAME as name,
        DESCRIPTION as description
      FROM ODER_FILE_FORMATS
      ORDER BY FORMAT_NAME
    `;

    const results = await executeQuery(query)
/*
    const results = await executeQuery(query, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        "ID": { type: oracledb.STRING },
        "FORMAT_NAME": { type: oracledb.STRING },
        "DESCRIPTION": { type: oracledb.STRING }
      }
    });
*/
    // Transform response to ensure correct casing
    const transformedResults = results.map((row: any) => ({
      id: row.ID || row.id,
      name: row.FORMAT_NAME || row.name || row.NAME,
      description: row.DESCRIPTION || row.description
    }));

    return NextResponse.json(transformedResults);
  } catch (error) {
    console.error('Error fetching file formats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch file formats' },
      { status: 500 }
    );
  }
}