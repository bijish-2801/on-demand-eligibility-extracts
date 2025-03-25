import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { FileFormat } from '@/types/database'

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

    // Specify the return type as an array of FileFormat
    const results = await executeQuery<FileFormat[]>(query);

    // Transform response to ensure correct casing
    const transformedResults = results.map((row) => ({
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