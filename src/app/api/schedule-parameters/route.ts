import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

// Define a type for the expected database row
interface ScheduleParameterRow {
  id?: string | number;
  ID?: string | number;
  frequency?: string;
  FREQUENCY?: string;
  name?: string;
  NAME?: string;
}

export async function GET() {
  try {
    const query = `
      SELECT 
        ID as id,
        FREQUENCY as name
      FROM ODER_SCHEDULE_PARAMETERS
      ORDER BY ID
    `;

    // Specify the type for executeQuery results
    const results = await executeQuery<ScheduleParameterRow[]>(query);
/*
    const results = await executeQuery(query, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        "ID": { type: oracledb.STRING },
        "FREQUENCY": { type: oracledb.STRING }
      }
    });
*/

    // Check if results is an array before mapping
    if (!Array.isArray(results)) {
      throw new Error('Expected array result from database query');
    }

    // Transform response to ensure correct casing
    const transformedResults = results.map((row: ScheduleParameterRow) => ({
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