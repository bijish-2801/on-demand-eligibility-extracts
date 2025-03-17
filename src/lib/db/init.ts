// src/lib/db/init.ts
import { initialize } from './index';

async function init() {
  try {
    await initialize();
//    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Export the init function
export default init;