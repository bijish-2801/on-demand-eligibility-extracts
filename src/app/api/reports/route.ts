import { NextRequest, NextResponse } from 'next/server';
import { initialize, closePool, executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

interface ReportData {
  reportName: string;
  description: string;
  lobId: string;
  subLobId: string;
  selectedFields: Array<{
    id: string;
    name: string;
  }>;
  criteriaRows: Array<{
    id: string;
    field: string;
    condition: string;
    value: string;
    connector: 'AND' | 'OR' | null;
  }>;
}

export async function POST(request: NextRequest) {
  let connection;
  try {
    const data: ReportData = await request.json();
    
    // Initialize the pool first if not already initialized
    await initialize();
    
    // Get connection from the pool with default alias
    connection = await oracledb.getConnection('default');
    
    // Start transaction
    await connection.execute('SET TRANSACTION NAME \'CreateReport\'');

    // 1. Insert into ODER_REPORTS and get the ID
    const reportResult = await connection.execute(
      `INSERT INTO ODER_REPORTS (
        NAME, 
        DESCRIPTION, 
        LOB_ID, 
        SUB_LOB_ID, 
        CREATED_BY,
        EXTRACT_ID
      ) VALUES (
        :name, 
        :description, 
        :lobId, 
        :subLobId, 
        :createdBy,
        (SELECT LB.PREFIX || '-' || SLB.PREFIX || '-' || TO_CHAR(SYSDATE, 'YYMMDDHHMMSS') 
         FROM ODER_LINES_OF_BUSINESS LB 
         JOIN ODER_SUB_LINES_OF_BUSINESS SLB ON LB.ID=SLB.LOB_ID 
         WHERE LB.ID=:lobId AND SLB.ID=:subLobId)
      ) RETURNING ID INTO :reportId`,
      {
        name: data.reportName,
        description: data.description,
        lobId: parseInt(data.lobId),
        subLobId: parseInt(data.subLobId),
        createdBy: '1', // Hardcoded as per requirement
        reportId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );

    const reportId = reportResult.outBinds.reportId[0];

    // 2. Insert into ODER_REPORT_FIELDS
    const fieldValues = data.selectedFields.map((field, index) => ({
      reportId,
      lookupFieldId: parseInt(field.lookup_field_id),
      displayOrder: field.display_order
    }));

    await connection.executeMany(
      `INSERT INTO ODER_REPORT_FIELDS (
        REPORT_ID, 
        LOOKUP_FIELD_ID, 
        DISPLAY_ORDER
      ) VALUES (
        :reportId, 
        :lookupFieldId, 
        :displayOrder
      )`,
      fieldValues
    );

    // 3. Insert into ODER_REPORT_CRITERIA_GROUPS and ODER_REPORT_CRITERIA
    for (let i = 0; i < data.criteriaRows.length; i++) {
      const row = data.criteriaRows[i];
      const isLastRow = i === data.criteriaRows.length - 1;
console.log(`ODER_REPORT_CRITERIA: field_id: ${row.lookup_field_id}; Operator ${row.operator_id}; criteria ${row.criteria_value}; order ${row.criteria_order}`);

      // Insert into ODER_REPORT_CRITERIA_GROUPS
      const groupResult = await connection.execute(
        `INSERT INTO ODER_REPORT_CRITERIA_GROUPS (
          REPORT_ID, 
          GROUP_ORDER, 
          OPERATOR
        ) VALUES (
          :reportId, 
          :groupOrder, 
          :operator
        ) RETURNING ID INTO :groupId`,
        {
          reportId,
          groupOrder: i + 1,
          operator: isLastRow ? null : row.group_operator,
          groupId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );

      const groupId = groupResult.outBinds.groupId[0];

      // Insert into ODER_REPORT_CRITERIA
      await connection.execute(
        `INSERT INTO ODER_REPORT_CRITERIA (
          REPORT_ID, 
          GROUP_ID, 
          LOOKUP_FIELD_ID, 
          OPERATOR_ID, 
          CRITERIA_VALUE, 
          CRITERIA_ORDER
        ) VALUES (
          :reportId, 
          :groupId, 
          :lookupFieldId, 
          :operatorId, 
          :criteriaValue, 
          :criteriaOrder
        )`,
        {
          reportId,
          groupId,
          lookupFieldId: parseInt(row.lookup_field_id),
          operatorId: parseInt(row.operator_id),
          criteriaValue: row.criteria_value,
          criteriaOrder: i + 1
        }
      );
    }

    // Commit the transaction
    await connection.commit();

    return NextResponse.json({ 
      success: true, 
      reportId 
    });

  } catch (error) {
    // Rollback the transaction if any error occurs
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error rolling back transaction API \app\api\reports\route.ts:', rollbackError);
      }
    }
    
    console.error('Error saving extract API \app\api\reports\route.ts:', error);
    return NextResponse.json(
      { error: 'Failed to save extract' },
      { status: 500 }
    );
  } finally {
    // Release the connection
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
  }
}

export async function GET(request: Request) {
  try {
    // Get search query from URL parameters
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('search') || ''
    const userId = 1 // Replace with actual user ID when authentication is implemented
    
    const query = `
      SELECT 
        r.ID,
        r.EXTRACT_ID,
        r.NAME,
        r.DESCRIPTION,
        l.NAME as LOB_NAME,
        sl.NAME as SUB_LOB_NAME
      FROM 
        ODER_REPORTS r
        JOIN ODER_LINES_OF_BUSINESS l ON r.LOB_ID = l.ID
        JOIN ODER_SUB_LINES_OF_BUSINESS sl ON r.SUB_LOB_ID = sl.ID
      WHERE 
        (r.IS_PUBLIC = 1 OR r.CREATED_BY = :userId)
        ${searchTerm ? "AND UPPER(r.NAME) LIKE UPPER(:searchPattern)" : ""}
      ORDER BY 
        r.CREATED_AT DESC
    `

    const params = [
      userId,
      ...(searchTerm ? [`%${searchTerm}%`] : [])
    ]

    // Use executeQuery with short-lived cache due to the dynamic nature of reports
    const result = await executeQuery<Array<any>>(
      query,
      params,
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT, // Use the proper Oracle constant
        useCache: false // No caching for actual extract results
//        cacheTTL: 5 * 1000 // 5 seconds cache, shorter due to frequently changing data
      }
    )

    // Transform the result to ensure consistent casing and data format
    const serializedRows = result.map(row => ({
      id: row.ID.toString(),
      extId: row.EXTRACT_ID ? row.EXTRACT_ID.toString() : '',
      name: row.NAME.toString(),
      description: row.DESCRIPTION ? row.DESCRIPTION.toString() : '',
      lobName: row.LOB_NAME.toString(),
      subLobName: row.SUB_LOB_NAME.toString()
    }));

    return NextResponse.json(serializedRows)
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}