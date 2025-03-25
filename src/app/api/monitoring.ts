import { getPoolStats } from '@/lib/db';

export async function getPoolStatus() {
  try {
    const stats = await getPoolStats();
    return {
      status: 'success',
      stats: stats || { busy: 0, open: 0, pending: 0 },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Type-check the error before accessing its properties
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error';
      
    return {
      status: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
}