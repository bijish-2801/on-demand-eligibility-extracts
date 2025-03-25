import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { FileDelimiter } from '@/types/database';
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

    // Specify the return type as an array of FileDelimiter
    const results = await executeQuery<FileDelimiter[]>(query);

    // Transform response to ensure correct casing
    const transformedResults = results.map((row) => ({
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