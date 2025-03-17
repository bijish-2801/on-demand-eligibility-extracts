import oracledb from 'oracledb';

process.env.UV_THREADPOOL_SIZE = '4';
process.env.NODE_ORACLEDB_NO_AUTO_CONFIG = 'true';

// Cache implementation
type CacheItem<T> = {
  data: T;
  timestamp: number;
};

class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheItem<any>>;
  private readonly DEFAULT_TTL = 0 * 60 * 1000; // 0 minutes in milliseconds

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl,
    });
  }

  public get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

const cacheManager = CacheManager.getInstance();

class Database {
  private static pool: oracledb.Pool | null = null;
  private static initializingPool: Promise<void> | null = null;
  private static cleanupInterval: NodeJS.Timeout | null = null;

  private static async validatePool(): Promise<boolean> {
    if (!this.pool) return false;
    
    try {
      const connection = await this.pool.getConnection();
      await connection.close();
      return true;
    } catch (error) {
      console.error('ODER: Pool validation failed:', error);
      return false;
    }
  }

  private static startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(async () => {
      const stats = await this.getPoolStats();
      if (stats && stats.open > stats.busy && stats.open > 1) {
        console.log('ODER: Cleaning up idle connections...');
        try {
          await this.pool?.close(1); // Soft close - only close idle connections
        } catch (error) {
          console.error('ODER: Error during cleanup:', error);
        }
      }
    }, 300000); // Run every 5 minutes
  }

  static async initialize() {
    if (this.pool) {
//      console.log('ODER: ****DATABASE POOL**** Already initialized');
      return;
    }

    // Guard against multiple simultaneous initializations
    if (this.initializingPool) {
      await this.initializingPool;
      return;
    }

    try {
      this.initializingPool = (async () => {
//        console.log('ODER: ****DATABASE POOL**** Initializing database pool...');
        
        // Check if there's an existing pool with the default alias and close it
        try {
          const existingPool = oracledb.getPool('default');
          if (existingPool) {
            await existingPool.close(0);
          }
        } catch (error) {
          // Ignore error if pool doesn't exist
          if (!(error instanceof Error && error.message.includes('NJS-047'))) {
            throw error;
          }
        }

        this.pool = await oracledb.createPool({
          user: process.env.ORACLE_USER,
          password: process.env.ORACLE_PASSWORD,
          connectString: process.env.ORACLE_CONNECTION_STRING,
          poolAlias: 'default',     // Explicitly set pool alias
          poolMin: 1,               // Reduce minimum connections
          poolMax: 4,               // Reduce maximum connections
          poolIncrement: 1,         // Allow incremental growth
          poolTimeout: 60,          // Increase timeout for idle connections
          queueTimeout: 30000,      // Reduce queue timeout
          enableStatistics: true,
          poolPingInterval: 60,     // Increase ping interval
          stmtCacheSize: 30,
          _enableStats: true,       // Enable detailed statistics
          closeOnPoolRelease: true  // Ensure connections are properly closed
        });
        
//        console.log('ODER: ****DATABASE POOL**** Initialized successfully');
        this.startCleanupInterval();
      })();

      await this.initializingPool;
    } catch (error) {
      console.error('ODER: ****DATABASE POOL**** FAILED TO CREATE DATABASE POOL:*** ', error);
      throw error;
    } finally {
      this.initializingPool = null;
    }
  }

  static async getConnection() {
    if (!this.pool || !(await this.validatePool())) {
      await this.initialize();
    }
    return await oracledb.getConnection('default');
  }

  static async executeQuery<T>(
    sql: string,
    params: any[] = [],
    options: oracledb.ExecuteOptions & { 
      useCache?: boolean;
      cacheTTL?: number;
    } = { 
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      useCache: true,
      cacheTTL: 5 * 60 * 1000 // 5 minutes default
    }
  ): Promise<T> {
    const { useCache, cacheTTL, ...oracleOptions } = options;
    
    // Generate cache key from SQL and params
    const cacheKey = `${sql}-${JSON.stringify(params)}`;

    // Check cache if enabled
    if (useCache) {
      const cachedResult = cacheManager.get<T>(cacheKey);
      if (cachedResult) {
        console.log('ODER: RETURNING CACHED RESULT for query:', sql);
        return cachedResult;
      }
    }

    let connection;
    try {
      connection = await this.getConnection();
      const result = await connection.execute(sql, params, oracleOptions);
      console.log('ODER:############QUERY EXECUTED SUCCESSFULLY########### ', sql, params, oracleOptions);

      // Cache the result if caching is enabled
      if (useCache && result.rows) {
        cacheManager.set(cacheKey, result.rows, cacheTTL);
      }

      return result.rows as T;
    } catch (error) {
      console.error('ODER:***Database query error:', sql, error);
      throw error;
    } finally {
      if (connection) {
        try {
          await connection.close();
//          console.log('ODER:   *Connection closed');
        } catch (error) {
          console.error('ODER:***Error closing connection:', error);
        }
      }
    }
  }

  static async closePool(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.pool) {
      try {
        await this.pool.close(0);
        this.pool = null;
//        console.log('ODER: ****DATABASE POOL**** Pool closed successfully');
      } catch (error) {
        console.error('ODER: ****DATABASE POOL**** ERROR CLOSING POOL:', error);
        throw error;
      }
    }
  }

  // Add method to get pool statistics
  static async getPoolStats(): Promise<{
    busy: number;
    open: number;
    pending: number;
  } | null> {
    if (!this.pool) {
      return null;
    }
    return await this.pool.getStatistics();
  }
}

// Cleanup handlers
const cleanup = async () => {
  console.log('ODER cleanup():Received termination signal. Closing database pool...');
  await Database.closePool();
};

// Remove existing listeners if any
const existingListeners = process.listeners('SIGTERM');
existingListeners.forEach(listener => process.removeListener('SIGTERM', listener));
process.addListener('SIGTERM', cleanup);

const existingIntListeners = process.listeners('SIGINT');
existingIntListeners.forEach(listener => process.removeListener('SIGINT', listener));
process.addListener('SIGINT', cleanup);

// Export the class methods bound to the class
export const initialize = Database.initialize.bind(Database);
export const executeQuery = Database.executeQuery.bind(Database);
export const closePool = Database.closePool.bind(Database);
export const getPoolStats = Database.getPoolStats.bind(Database);
export const getConnection = Database.getConnection.bind(Database);