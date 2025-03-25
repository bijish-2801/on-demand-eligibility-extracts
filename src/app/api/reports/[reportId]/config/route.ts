import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import oracledb from 'oracledb';

// Define appropriate interfaces for type safety
interface ReportConfig {
  REPORTNAME?: string;
  reportName?: string;
  DESCRIPTION?: string;
  description?: string;
  LOBNAME?: string;
  lobName?: string;
  SUBLOBNAME?: string;
  subLobName?: string;
  FILEFORMATID?: string;
  fileFormatId?: string;
  FILEDELIMITERID?: string;
  fileDelimiterId?: string;
  SCHEDULEPARAMETERID?: string;
  scheduleParameterId?: string;
  REPORTRUNTIME?: string;
  reportRuntime?: string;
  SFTPSERVERID?: string;
  sftpServerId?: string;
  SFTPPATH?: string;
  sftpPath?: string;
  EMAILDLLIST?: string;
  emailDlList?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = params;

    // Modified query to get both report details and configuration
    const query = `
      SELECT 
        r.NAME as reportName,
        r.DESCRIPTION as description,
        lb.NAME as lobName,
        slb.NAME as subLobName,
        rc.FILE_FORMAT_ID as fileFormatId,
        rc.FILE_DELIMITER_ID as fileDelimiterId,
        rc.SCHEDULE_PARAMETER_ID as scheduleParameterId,
        rc.REPORT_RUNTIMES as reportRuntime,
        rc.SFTP_SERVER_ID as sftpServerId,
        rc.SFTP_PATH as sftpPath,
        rc.EMAIL_DL_LIST as emailDlList
      FROM ODER_REPORTS r
      JOIN ODER_LINES_OF_BUSINESS lb ON r.LOB_ID = lb.ID
      JOIN ODER_SUB_LINES_OF_BUSINESS slb ON r.SUB_LOB_ID = slb.ID
      LEFT JOIN ODER_REPORT_CONFIGS rc ON r.ID = rc.REPORT_ID
      WHERE r.ID = :reportId
    `;

    const result = await executeQuery<ReportConfig[]>(
      query, 
      [reportId], // Changed from object to array
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false
      }
    );
    
    if (result && result.length > 0) {
      // Transform the result to ensure proper casing of properties
      const transformedResult = {
        reportName: result[0].REPORTNAME || result[0].reportName,
        description: result[0].DESCRIPTION || result[0].description,
        lobName: result[0].LOBNAME || result[0].lobName,
        subLobName: result[0].SUBLOBNAME || result[0].subLobName,
        fileFormatId: result[0].FILEFORMATID || result[0].fileFormatId,
        fileDelimiterId: result[0].FILEDELIMITERID || result[0].fileDelimiterId,
        scheduleParameterId: result[0].SCHEDULEPARAMETERID || result[0].scheduleParameterId,
        reportRuntime: result[0].REPORTRUNTIME || result[0].reportRuntime,
        sftpServerId: result[0].SFTPSERVERID || result[0].sftpServerId,
        sftpPath: result[0].SFTPPATH || result[0].sftpPath,
        emailDlList: result[0].EMAILDLLIST || result[0].emailDlList
      };

      return NextResponse.json(transformedResult);
    }
    
    // If no result, return default structure
    return NextResponse.json({
      reportName: '',
      description: '',
      lobName: '',
      subLobName: '',
      fileFormatId: '',
      fileDelimiterId: '',
      scheduleParameterId: '',
      reportRuntime: '',
      sftpServerId: '',
      sftpPath: '',
      emailDlList: ''
    });

  } catch (error) {
    console.error('Error fetching Extract Configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Extract Configuration' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const { reportId } = params;
    const data = await request.json();
    const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Check if configuration exists
    const checkQuery = `
      SELECT REPORT_ID 
      FROM ODER_REPORT_CONFIGS 
      WHERE REPORT_ID = :reportId
    `;
    const existingConfig = await executeQuery<Array<{ REPORT_ID: string }>>(
      checkQuery, 
      [reportId], // Changed from object to array
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: false
      }
    );
    
    let query;
    let queryParams;

    if (existingConfig.length > 0) {
      // Update existing configuration
      query = `
        UPDATE ODER_REPORT_CONFIGS
        SET 
          FILE_FORMAT_ID = :fileFormatId,
          FILE_DELIMITER_ID = :fileDelimiterId,
          SCHEDULE_PARAMETER_ID = :scheduleParameterId,
          REPORT_RUNTIMES = :reportRuntime,
          SFTP_SERVER_ID = :sftpServerId,
          SFTP_PATH = :sftpPath,
          EMAIL_DL_LIST = :emailDlList
        WHERE REPORT_ID = :reportId
      `;
      queryParams = {
        fileFormatId: data.fileFormatId,
        fileDelimiterId: data.fileDelimiterId,
        scheduleParameterId: data.scheduleParameterId,
        reportRuntime: data.reportRuntime,
        sftpServerId: data.sftpServerId,
        sftpPath: data.sftpPath,
        emailDlList: data.emailDlList,
        reportId: reportId
      };
    } else {
      // Insert new configuration
      query = `
        INSERT INTO ODER_REPORT_CONFIGS (
          REPORT_ID,
          FILE_FORMAT_ID,
          FILE_DELIMITER_ID,
          SCHEDULE_PARAMETER_ID,
          REPORT_RUNTIMES,
          SFTP_SERVER_ID,
          SFTP_PATH,
          EMAIL_DL_LIST
        ) VALUES (
          :reportId,
          :fileFormatId,
          :fileDelimiterId,
          :scheduleParameterId,
          :reportRuntime,
          :sftpServerId,
          :sftpPath,
          :emailDlList
        )
      `;
      queryParams = {
        reportId: reportId,
        fileFormatId: data.fileFormatId,
        fileDelimiterId: data.fileDelimiterId,
        scheduleParameterId: data.scheduleParameterId,
        reportRuntime: data.reportRuntime,
        sftpServerId: data.sftpServerId,
        sftpPath: data.sftpPath,
        emailDlList: data.emailDlList,
      };
    }

    try {
      await executeQuery<any>(
        query, 
        queryParams, 
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          autoCommit: true
        }
      );
      
      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

  } catch (error) {
    console.error('Error saving report configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save report configuration' },
      { status: 500 }
    );
  }
}