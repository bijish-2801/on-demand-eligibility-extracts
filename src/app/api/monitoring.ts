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
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}