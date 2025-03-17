import { executeQuery } from '@/lib/db';
import { NextResponse } from 'next/server';
import oracledb from 'oracledb';

interface ExecuteReportRequest {
  limit?: number;
  page?: number;
  pageSize?: number;
}

export async function POST(
  request: Request,
  context: { params: { reportId: string } }
) {
  const params = await Promise.resolve(context.params);
  const reportId = params.reportId;
  
  try {
    if (!reportId) {
      return NextResponse.json(
        { error: 'Extract ID is required' },
        { status: 400 }
      );
    }

    const userId = '1'; // TODO: Replace with actual user ID when authentication is implemented
    const body = await request.json() as ExecuteReportRequest;
    const { limit = 50, page = 1, pageSize = 10 } = body;
    
    // First verify the Extract exists and user has access
    const reportQuery = `
      SELECT 
        r.ID,
        r.NAME,
        r.QUERY_STATEMENT,
        r.IS_PUBLIC,
        r.CREATED_BY
      FROM 
        ODER_REPORTS r
      WHERE 
        r.ID = :reportId
        AND (r.IS_PUBLIC = 1 OR r.CREATED_BY = :userId)
    `;

    const reportResult = await executeQuery<Array<any>>(
      reportQuery,
      [reportId, userId],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false
      }
    );

    if (!reportResult || reportResult.length === 0) {
      return NextResponse.json(
        { error: 'Extract not found or access denied' },
        { status: 404 }
      );
    }

    const report = reportResult[0];
    
    // Check if QUERY_STATEMENT exists
    if (!report.QUERY_STATEMENT) {
      return NextResponse.json(
        { error: 'Query statement not found for this Extract' },
        { status: 400 }
      );
    }

    const queryStatement = report.QUERY_STATEMENT.toString();

    // Add pagination to the query
    const offset = (page - 1) * pageSize;
    const paginatedQuery = `
      WITH base_query AS (
        ${queryStatement}
      )
      SELECT *
      FROM (
        SELECT a.*, ROWNUM rnum
        FROM (
          SELECT * FROM base_query
          ORDER BY 1
        ) a WHERE ROWNUM <= ${offset + pageSize}
      ) WHERE rnum > ${offset}
    `;

    // Get total count
    const countQuery = `
      WITH base_query AS (
        ${queryStatement}
      )
      SELECT COUNT(*) as total_count
      FROM base_query
    `;

    // Execute both queries in parallel
    const [resultData, countData] = await Promise.all([
      executeQuery<Array<any>>(paginatedQuery, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false
      }),
      executeQuery<Array<any>>(countQuery, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false
      })
    ]);

    // Extract column names from the first row
    const columns = resultData.length > 0 
      ? Object.keys(resultData[0]).filter(key => key !== 'RNUM')
      : [];

    // Format the response data
    const formattedData = resultData.map(row => {
      const formattedRow: Record<string, any> = {};
      for (const key of columns) {
        const value = row[key];
        // Format dates and other special types as needed
        formattedRow[key] = value instanceof Date 
          ? value.toISOString().split('T')[0]
          : value?.toString() || null;
      }
      return formattedRow;
    });

    return NextResponse.json({
      reportId: report.ID.toString(),
      reportName: report.NAME.toString(),
      columns,
      data: formattedData,
      totalCount: countData[0].TOTAL_COUNT,
      currentPage: page,
      pageSize,
      hasMore: (page * pageSize) < countData[0].TOTAL_COUNT
    });

  } catch (error) {
    console.error('Error executing Extract:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute Extract',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}