import { executeQuery, initialize } from '@/lib/db';
import { NextResponse } from 'next/server';
import oracledb from 'oracledb';

export async function GET() {
  try {
    // Ensure database is initialized
    await initialize();
    
    // Execute a simple health check query
    const result = await executeQuery<Array<{ 
      CURRENT_DATE: Date; 
      DB_USER: string;
      APP_VERSION: string;
    }>>(
      `SELECT 
        SYSDATE AS CURRENT_DATE,
        SYS_CONTEXT('USERENV', 'SESSION_USER') AS DB_USER,
        '1.0.0' AS APP_VERSION
      FROM DUAL`,
      [],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        useCache: true,
        cacheTTL: 60 * 1000 // 1 minute cache for health check
      }
    );

    if (!result || result.length === 0) {
      throw new Error('Health check query returned no results');
    }

    const healthData = result[0];
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        currentTime: healthData.CURRENT_DATE,
        user: healthData.DB_USER
      },
      application: {
        version: healthData.APP_VERSION,
        environment: process.env.NODE_ENV || 'development',
        user: '1'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: {
          message: 'Database connection failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 503 } // Service Unavailable
    );
  }
}