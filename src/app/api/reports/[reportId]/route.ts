import { executeQuery, initialize } from '@/lib/db';
import { NextResponse } from 'next/server';
import oracledb from 'oracledb';

// Add interface for Oracle binding results
interface OracleBindOutResult {
  outBinds: {
    groupId?: number[];
    returnId?: number[];
    [key: string]: any;
  };
  [key: string]: any;
}

export async function GET(
  request: Request,
  context: { params: { reportId: string } }
) {
  const params = await Promise.resolve(context.params);
  const reportId = params.reportId;
  const userId = 1; // Replace with actual user ID when authentication is implemented

  try {
    // First, get the Extract details
    const reportQuery = `
      SELECT 
        r.ID,
        r.NAME,
        r.DESCRIPTION,
        r.CREATED_AT,
        r.UPDATED_AT,
        r.CREATED_BY,
        r.IS_PUBLIC,
        l.ID as LOB_ID,
        l.NAME as LOB_NAME,
        sl.ID as SUB_LOB_ID,
        sl.NAME as SUB_LOB_NAME,
	    r.QUERY_STATEMENT
      FROM 
        ODER_REPORTS r
        JOIN ODER_LINES_OF_BUSINESS l ON r.LOB_ID = l.ID
        LEFT JOIN ODER_SUB_LINES_OF_BUSINESS sl ON r.SUB_LOB_ID = sl.ID
      WHERE 
        r.ID = :1
        AND (r.IS_PUBLIC = 1 OR r.CREATED_BY = :2)
    `;

    // Get selected fields
    const fieldsQuery = `
      SELECT 
        lf.ID,
        lf.DISPLAY_NAME as NAME,
        rf.DISPLAY_ORDER
      FROM 
        ODER_REPORT_FIELDS rf
        JOIN ODER_LOOKUP_SELECT_FIELDS lf ON rf.LOOKUP_FIELD_ID = lf.ID
      WHERE 
        rf.REPORT_ID = :1
      ORDER BY 
        rf.DISPLAY_ORDER
    `;

    // Get criteria rows
    const criteriaQuery = `
      SELECT 
        rc.ID,
        rc.LOOKUP_FIELD_ID as FIELD_ID,
        lf.DISPLAY_NAME as FIELD_NAME,
        rc.OPERATOR_ID as CONDITION_ID,
        op.OPERATOR_SYMBOL as CONDITION_SYMBOL,
        rc.CRITERIA_VALUE as VALUE,
        rcg.OPERATOR as CONNECTOR
      FROM 
        ODER_REPORT_CRITERIA rc
        JOIN ODER_REPORT_CRITERIA_GROUPS rcg ON rc.GROUP_ID = rcg.ID
        JOIN ODER_LOOKUP_CRITERIA_FIELDS lf ON rc.LOOKUP_FIELD_ID = lf.ID
        JOIN ODER_OPERATORS op ON rc.OPERATOR_ID = op.ID
      WHERE 
        rc.REPORT_ID = :1
      ORDER BY 
        rcg.GROUP_ORDER, rc.CRITERIA_ORDER
    `;

    // Execute all queries in parallel
    const [reportResult, fieldsResult, criteriaResult] = await Promise.all([
      executeQuery<Array<any>>(reportQuery, [reportId, userId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false,
        cacheTTL: 2 * 60 * 1000 // 2 minutes cache
      }),
      executeQuery<Array<any>>(fieldsQuery, [reportId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false,
        cacheTTL: 2 * 60 * 1000
      }),
      executeQuery<Array<any>>(criteriaQuery, [reportId], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false,
        cacheTTL: 2 * 60 * 1000
      })
    ]);

    if (!reportResult || reportResult.length === 0) {
      return NextResponse.json(
        { error: 'Extract not found or access denied' },
        { status: 404 }
      );
    }

    // Transform the results
    const report = reportResult[0];
    const response = {
      id: report.ID.toString(),
      name: report.NAME,
      description: report.DESCRIPTION || '',
      createdAt: report.CREATED_AT,
      modifiedAt: report.UPDATED_AT,
      createdBy: report.CREATED_BY.toString(),
      isPublic: Boolean(report.IS_PUBLIC),
	  queryStatement: report.QUERY_STATEMENT || '',
      lob: {
        id: report.LOB_ID.toString(),
        name: report.LOB_NAME
      },
      subLob: report.SUB_LOB_ID ? {
        id: report.SUB_LOB_ID.toString(),
        name: report.SUB_LOB_NAME
      } : null,
      selectedFields: fieldsResult.map(field => ({
        id: field.ID.toString(),
        name: field.NAME
      })),
      criteriaRows: criteriaResult.map(criteria => ({
        id: criteria.ID.toString(),
        field: criteria.FIELD_ID.toString(),
        fieldName: criteria.FIELD_NAME,
        condition: criteria.CONDITION_ID.toString(),
        conditionSymbol: criteria.CONDITION_SYMBOL,
        value: criteria.VALUE,
        connector: criteria.CONNECTOR as 'AND' | 'OR' | null
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching Extract:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Extract' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { reportId: string } }
) {
  const params = await Promise.resolve(context.params);
  const reportId = params.reportId;
  const userId = '1'; // TODO: Replace with actual user ID when authentication is implemented
  let connection;

  try {
    const data = await request.json();
    
    // Initialize the pool before getting connection
    await initialize();
    
    // Initialize the pool and get connection
    connection = await oracledb.getConnection();
    
    // Start transaction
    await connection.execute('SET TRANSACTION NAME \'UpdateReport\'');

    // First verify access
    const accessResult = await connection.execute(
      `SELECT ID FROM ODER_REPORTS 
       WHERE ID = :reportId 
       AND (IS_PUBLIC = 1 OR CREATED_BY = :userId)`,
      { reportId: parseInt(reportId), userId: parseInt(userId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!accessResult.rows || accessResult.rows.length === 0) {
      throw new Error('Extract not found or access denied');
    }

    // Update Extract details
    await connection.execute(
      `UPDATE ODER_REPORTS
       SET NAME = :name,
           DESCRIPTION = :description,
           SUB_LOB_ID = :subLobId,
           UPDATED_AT = CURRENT_TIMESTAMP
       WHERE ID = :reportId`,
      {
        name: data.reportName,
        description: data.description,
        subLobId: parseInt(data.subLobId),
        reportId: parseInt(reportId)
      }
    );

    // Update selected fields
    await connection.execute(
      'DELETE FROM ODER_REPORT_FIELDS WHERE REPORT_ID = :reportId',
      { reportId: parseInt(reportId) }
    );

    if (data.selectedFields?.length > 0) {
      await connection.executeMany(
        `INSERT INTO ODER_REPORT_FIELDS (
          REPORT_ID, LOOKUP_FIELD_ID, DISPLAY_ORDER
        ) VALUES (:reportId, :lookupFieldId, :displayOrder)`,
        data.selectedFields.map((field: any, index: number) => ({
          reportId: parseInt(reportId),
          lookupFieldId: parseInt(field.id),
          displayOrder: index + 1
        }))
      );
    }

    // Update criteria
    await connection.execute(
      'DELETE FROM ODER_REPORT_CRITERIA WHERE REPORT_ID = :reportId',
      { reportId: parseInt(reportId) }
    );

    await connection.execute(
      'DELETE FROM ODER_REPORT_CRITERIA_GROUPS WHERE REPORT_ID = :reportId',
      { reportId: parseInt(reportId) }
    );

    if (data.criteriaRows?.length > 0) {
      for (let i = 0; i < data.criteriaRows.length; i++) {
        const row = data.criteriaRows[i];
        const isLastRow = i === data.criteriaRows.length - 1;

        // Insert criteria group
        const groupResult = await connection.execute(
          `INSERT INTO ODER_REPORT_CRITERIA_GROUPS (
            REPORT_ID, GROUP_ORDER, OPERATOR
          ) VALUES (:reportId, :groupOrder, :operator)
          RETURNING ID INTO :groupId`,
          {
            reportId: parseInt(reportId),
            groupOrder: i + 1,
            operator: isLastRow ? null : row.connector,
            groupId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
          }
        ) as OracleBindOutResult; // Type assertion for proper TypeScript support

        const groupId = groupResult.outBinds.groupId?.[0];

        // Insert criteria
        await connection.execute(
          `INSERT INTO ODER_REPORT_CRITERIA (
            REPORT_ID, GROUP_ID, LOOKUP_FIELD_ID, 
            OPERATOR_ID, CRITERIA_VALUE, CRITERIA_ORDER
          ) VALUES (
            :reportId, :groupId, :lookupFieldId,
            :operatorId, :criteriaValue, :criteriaOrder
          )`,
          {
            reportId: parseInt(reportId),
            groupId,
            lookupFieldId: parseInt(row.field),
            operatorId: parseInt(row.condition),
            criteriaValue: row.value,
            criteriaOrder: i + 1
          }
        );
console.log('** * ** *PATCH* ** ** ** row.field:', row.field);
console.log('** * ** *PATCH* ** ** ** row.condition:', row.condition);
console.log('** * ** *PATCH* ** ** ** row.value:', row.value);
      }
    }

    // Generate and update query statement
    const queryStatement = await generateQueryStatement(reportId, connection);
    await connection.execute(
      `UPDATE ODER_REPORTS 
       SET QUERY_STATEMENT = :queryStatement 
       WHERE ID = :reportId`,
      { queryStatement, reportId: parseInt(reportId) }
    );
console.log('** * ** *PATCH* ** ** ** queryStatement:', {queryStatement});

    // Commit transaction
    await connection.commit();

    return NextResponse.json({ 
      success: true,
      message: 'Extract updated successfully'
    });

  } catch (error) {
    // Rollback on error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }

    console.error('Error updating Extract:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Extract'
      },
      { status: 500 }
    );
  } finally {
    // Release connection
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
  }
}

export async function PUT(
  request: Request,
  context: { params: { reportId: string } }
) {
  const params = await Promise.resolve(context.params);
  const reportId = params.reportId;
  const userId = '1'; // TODO: Replace with actual user ID when authentication is implemented
  let connection;
  
  try {
    const data = await request.json();
    
    // Initialize the pool before getting connection
    await initialize();
    
    // Get a connection from the pool (without specifying alias)
    connection = await oracledb.getConnection();
    
    // Start transaction
    await connection.execute('SET TRANSACTION NAME \'UpdateReportQuery\'');

    // Verify access to report
    const accessResult = await connection.execute(
      `SELECT ID FROM ODER_REPORTS 
       WHERE ID = :reportId 
       AND (IS_PUBLIC = 1 OR CREATED_BY = :userId)`,
      { reportId: parseInt(reportId), userId: parseInt(userId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!accessResult.rows || accessResult.rows.length === 0) {
      throw new Error('Extract not found or access denied');
    }

    // Clear existing criteria (Delete from child table first to maintain referential integrity)
    await connection.execute(
      'DELETE FROM ODER_REPORT_CRITERIA WHERE REPORT_ID = :reportId',
      { reportId: parseInt(reportId) }
    );

    await connection.execute(
      'DELETE FROM ODER_REPORT_CRITERIA_GROUPS WHERE REPORT_ID = :reportId',
      { reportId: parseInt(reportId) }
    );

    // Insert new criteria rows
    let groupId;
    if (data.criteriaRows?.length > 0) {
      for (let i = 0; i < data.criteriaRows.length; i++) {
        const row = data.criteriaRows[i];
        const isLastRow = i === data.criteriaRows.length - 1;
console.log (':::isLastRow:::', isLastRow);
        
        // Insert criteria group
        const groupResult = await connection.execute(
          `INSERT INTO ODER_REPORT_CRITERIA_GROUPS (
            REPORT_ID, GROUP_ORDER, OPERATOR
          ) VALUES (:reportId, :groupOrder, :operator)
          RETURNING ID INTO :returnId`,
          {
            reportId: parseInt(reportId),
            groupOrder: i + 1,
            operator: isLastRow ? null : row.group_operator || row.connector || 'AND', // Handle different field names
            returnId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
          }
        ) as OracleBindOutResult; // Type assertion for proper TypeScript support
        
        groupId = groupResult.outBinds.returnId?.[0];
        
        // Insert criteria row
        await connection.execute(
          `INSERT INTO ODER_REPORT_CRITERIA (
            REPORT_ID, GROUP_ID, LOOKUP_FIELD_ID, 
            OPERATOR_ID, CRITERIA_VALUE, CRITERIA_ORDER
          ) VALUES (
            :reportId, :groupId, :lookupFieldId,
            :operatorId, :criteriaValue, :criteriaOrder
          )`,
          {
            reportId: parseInt(reportId),
            groupId,
            lookupFieldId: parseInt(row.lookup_field_id || row.field),
            operatorId: parseInt(row.operator_id || row.condition),
            criteriaValue: row.criteria_value || row.value,
            criteriaOrder: i + 1
          }
        );
      }
    }

    // Update selected fields if provided
    if (data.selectedFields && data.selectedFields.length > 0) {
      // First clear existing fields
      await connection.execute(
        'DELETE FROM ODER_REPORT_FIELDS WHERE REPORT_ID = :reportId',
        { reportId: parseInt(reportId) }
      );
      
      // Then insert new fields
      for (let i = 0; i < data.selectedFields.length; i++) {
        const field = data.selectedFields[i];
        await connection.execute(
          `INSERT INTO ODER_REPORT_FIELDS (
            REPORT_ID, LOOKUP_FIELD_ID, DISPLAY_ORDER
          ) VALUES (
            :reportId, :lookupFieldId, :displayOrder
          )`,
          {
            reportId: parseInt(reportId),
            lookupFieldId: parseInt(field.lookup_field_id),
            displayOrder: i + 1
          }
        );
      }
    }

    // Get selected fields
    const fieldsQuery = `
      SELECT 
        lk.FIELD_NAME, 
        lk.DISPLAY_NAME 
      FROM ODER_REPORT_FIELDS rf 
      JOIN ODER_LOOKUP_SELECT_FIELDS lk ON rf.lookup_field_id = lk.id
      WHERE report_id = :reportId
      ORDER BY rf.DISPLAY_ORDER
    `;

    // Get criteria
    const criteriaQuery = `
      SELECT 
        lk.field_type,
        lk.field_name as CRITERIA_FIELD,
        op.operator_symbol,
        rc.CRITERIA_VALUE,
        cg.OPERATOR as CRITERIA_GROUP_OPERATOR
      FROM ODER_REPORT_CRITERIA rc
      JOIN ODER_REPORT_CRITERIA_GROUPS cg ON rc.group_id = cg.id
      JOIN ODER_LOOKUP_CRITERIA_FIELDS lk ON rc.lookup_field_id = lk.id
      JOIN ODER_OPERATORS op ON rc.operator_id = op.id
      WHERE rc.report_id = :reportId
      ORDER BY rc.criteria_order
    `;

    // Execute both queries
    const [fieldsResult, criteriaResult] = await Promise.all([
      connection.execute(fieldsQuery, { reportId: parseInt(reportId) }, 
        { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      connection.execute(criteriaQuery, { reportId: parseInt(reportId) }, 
        { outFormat: oracledb.OUT_FORMAT_OBJECT })
    ]);

    // Build SELECT clause
    const selectClause = (fieldsResult.rows || [])
      .map((field: any) => `${field.FIELD_NAME} "${field.DISPLAY_NAME}"`)
      .join(', ');

    // Build WHERE clause
    let whereClause = '';
    if (criteriaResult.rows && criteriaResult.rows.length > 0) {
      whereClause = 'WHERE ';
      criteriaResult.rows.forEach((criteria: any, index: number) => {
        let value = criteria.CRITERIA_VALUE;
        
        // Handle different field types
        if (criteria.FIELD_TYPE === 'DATE') {
          value = `TO_DATE('${value}', 'YYYY-MM-DD')`;
        } else if (criteria.FIELD_TYPE === 'VARCHAR') {
          value = `'${value}'`;
        }

        whereClause += `${criteria.CRITERIA_FIELD} ${criteria.OPERATOR_SYMBOL} ${value}`;

        if (criteria.CRITERIA_GROUP_OPERATOR) {
          whereClause += ` ${criteria.CRITERIA_GROUP_OPERATOR} `;
        }
console.log('** * ** *PUT* ** ** ** criteria:', {criteria});
console.log('** * ** *PUT* ** ** ** whereClause:', {whereClause});
      });
    }

    // Construct final query
    const queryStatement = `SELECT ${selectClause}
      FROM MEMBERSHIP M
      INNER JOIN MEMBER_COVERAGE MC ON M.MEMBER_ID = MC.MEMBER_ID
--	  JOIN ODER_LINES_OF_BUSINESS LB ON LB.SOURCE_SYS_ID=M.SOURCE_SYS_ID 
      ${whereClause} 
	  and M.SOURCE_SYS_ID='2001' 
	  and rownum <=50`;

    // Update the report with the new query statement
    await connection.execute(
      `UPDATE ODER_REPORTS
       SET QUERY_STATEMENT = :queryStatement,
           UPDATED_AT = SYSTIMESTAMP
       WHERE ID = :reportId`,
      { 
        queryStatement, 
        reportId: parseInt(reportId) 
      }
    );

    // Commit the transaction
    await connection.commit();

    console.log(`Query statement updated for report ${reportId}`);
    
    return NextResponse.json({ 
      success: true,
      queryStatement
    });

  } catch (error) {
    // Rollback on error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError);
      }
    }
    
    console.error('Error updating Extract query:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update Extract query'
      },
      { status: 500 }
    );
  } finally {
    // Release connection
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError);
      }
    }
  }
}

// Helper function to generate query statement
async function generateQueryStatement(reportId: string | number, connection: oracledb.Connection): Promise<string> {

  // Get selected fields
  const fieldsQuery = 
      `SELECT lf.FIELD_NAME, lf.DISPLAY_NAME
       FROM ODER_REPORT_FIELDS rf
       JOIN ODER_LOOKUP_SELECT_FIELDS lf ON rf.LOOKUP_FIELD_ID = lf.ID
       WHERE rf.REPORT_ID = :reportId
       ORDER BY rf.DISPLAY_ORDER`;

    // Get criteria
    const criteriaQuery = 
      `SELECT lf.FIELD_NAME, op.OPERATOR_SYMBOL, rc.CRITERIA_VALUE,
              rcg.OPERATOR as GROUP_OPERATOR, lf.FIELD_TYPE
       FROM ODER_REPORT_CRITERIA rc
       JOIN ODER_REPORT_CRITERIA_GROUPS rcg ON rc.GROUP_ID = rcg.ID
       JOIN ODER_LOOKUP_CRITERIA_FIELDS lf ON rc.LOOKUP_FIELD_ID = lf.ID
       JOIN ODER_OPERATORS op ON rc.OPERATOR_ID = op.ID
       WHERE rc.REPORT_ID = :reportId
       ORDER BY rcg.GROUP_ORDER, rc.CRITERIA_ORDER`;

  interface OracleResult<T = any> {
    rows?: T[];
    [key: string]: any;
  }

  const [fieldsResult, criteriaResult] = await Promise.all([
    connection.execute(
	  fieldsQuery,
      { reportId: parseInt(reportId.toString()) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    ) as Promise<OracleResult>,
    connection.execute(
	  criteriaQuery,
      { reportId: parseInt(reportId.toString()) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    ) as Promise<OracleResult>
  ]);

  // Build SELECT clause
  const selectClause = (fieldsResult.rows || []).map((field: any) => 
    `${field.FIELD_NAME} as "${field.DISPLAY_NAME}"`
  ).join(', ') || '';

  // Build WHERE clause
  let whereClause = '';
//  if (criteriaResult.rows?.length > 0) {
  if (criteriaResult.rows && criteriaResult.rows.length > 0) {
    whereClause = 'WHERE ';
    // Use optional chaining here too, with fallback to an empty array
    (criteriaResult.rows || []).forEach((criteria: any, index: number) => {
      if (criteria.GROUP_OPERATOR) {
        whereClause += ` ${criteria.GROUP_OPERATOR} `;
      }

      let value = criteria.CRITERIA_VALUE;
      if (criteria.FIELD_TYPE === 'DATE') {
        value = `TO_DATE('${value}', 'YYYY-MM-DD')`;
      } else if (criteria.FIELD_TYPE === 'VARCHAR') {
        value = `'${value}'`;
      }

      whereClause += `${criteria.FIELD_NAME} ${criteria.OPERATOR_SYMBOL} ${value}`;
    });
  }

  console.log('** * ** *GENERATEQUERYSTATEMENT* ** ** ** whereClause:', {whereClause});

  return `
    SELECT ${selectClause}
    FROM MEMBERSHIP M
    INNER JOIN MEMBER_COVERAGE MC ON M.MEMBER_ID = MC.MEMBER_ID
--    JOIN ODER_LINES_OF_BUSINESS LB ON LB.SOURCE_SYS_ID=M.SOURCE_SYS_ID 
    ${whereClause} 
    and M.SOURCE_SYS_ID='2001' 
	and rownum <=50
  `.trim();
}