import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

export async function GET() {
  try {
    const query = `
      SELECT 
        ID as id,
        SERVER_NAME as name,
        DESCRIPTION as description
      FROM ODER_SFTP_SERVERS
      ORDER BY SERVER_NAME
    `;

    const results = await executeQuery(query)
/*
    const results = await executeQuery(query, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        "ID": { type: oracledb.STRING },
        "SERVER_NAME": { type: oracledb.STRING },
        "DESCRIPTION": { type: oracledb.STRING }
      }
    });
*/
    // Transform response to ensure correct casing
    const transformedResults = results.map((row: any) => ({
      id: row.ID || row.id,
      name: row.SERVER_NAME || row.name || row.NAME,
      description: row.DESCRIPTION || row.description
    }));

    return NextResponse.json(transformedResults);
  } catch (error) {
    console.error('Error fetching SFTP servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SFTP servers' },
      { status: 500 }
    );
  }
}