import { LogGeneratorManager } from './LogGeneratorManager';
import { logger } from './utils/logger';

// Main entry point for running as a service
async function main() {
  const configPath = process.env.CONFIG_PATH;
  const logGenerator = new LogGeneratorManager(configPath);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    await logGenerator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    await logGenerator.stop();
    process.exit(0);
  });

  try {
    await logGenerator.start();
    logger.info('Log generator service is running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error('Failed to start log generator:', error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { LogGeneratorManager };
export * from './types';
export * from './generators';
export * from './replay';
export * from './utils/logger';
export * from './config';
