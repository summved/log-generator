#!/usr/bin/env node

import { Command } from 'commander';
import { LogGeneratorManager } from './LogGeneratorManager';
import { logger } from './utils/logger';
import * as fs from 'fs-extra';
import * as path from 'path';

const program = new Command();

program
  .name('log-generator')
  .description('Multi-source log generator for SIEM solutions with replay functionality')
  .version('1.0.0');

program
  .command('generate')
  .description('Start generating logs from configured sources')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-d, --daemon', 'Run as daemon (background process)')
  .action(async (options) => {
    try {
      const logGenerator = new LogGeneratorManager(options.config);
      
      if (options.daemon) {
        logger.info('Starting log generator in daemon mode');
        // In a production environment, you'd want to use a proper daemon library
        process.stdout.write('Log generator started in background\n');
      }

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

      await logGenerator.start();
      
      if (!options.daemon) {
        console.log('Log generator is running. Press Ctrl+C to stop.');
        // Keep the process running
        await new Promise(() => {});
      }
    } catch (error) {
      logger.error('Failed to start log generation:', error);
      process.exit(1);
    }
  });

program
  .command('replay')
  .description('Replay historical logs')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-f, --file <filename>', 'Specific historical file to replay')
  .option('-s, --speed <multiplier>', 'Replay speed multiplier (default: 1.0)', parseFloat)
  .option('-l, --loop', 'Loop replay continuously')
  .option('--start-time <timestamp>', 'Start time for replay (ISO format)')
  .option('--end-time <timestamp>', 'End time for replay (ISO format)')
  .action(async (options) => {
    try {
      const logGenerator = new LogGeneratorManager(options.config);
      
      // Update replay config with CLI options
      if (options.speed || options.loop || options.startTime || options.endTime) {
        const config = logGenerator.getConfig();
        const replayConfig = {
          ...config.replay,
          enabled: true,
          ...(options.speed && { speed: options.speed }),
          ...(options.loop && { loop: true }),
          ...(options.startTime && { startTime: options.startTime }),
          ...(options.endTime && { endTime: options.endTime })
        };
        
        logGenerator.updateConfig({ replay: replayConfig });
      }

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        logger.info('Stopping replay');
        logGenerator.stopReplay();
        process.exit(0);
      });

      await logGenerator.startReplay(options.file);
      
      // Monitor replay progress
      const progressInterval = setInterval(() => {
        const status = logGenerator.getReplayStatus();
        if (status.isReplaying) {
          console.log(`Replay progress: ${status.currentIndex}/${status.totalLogs} (${status.progress.toFixed(1)}%)`);
        } else {
          console.log('Replay completed');
          clearInterval(progressInterval);
          process.exit(0);
        }
      }, 5000);

    } catch (error) {
      logger.error('Failed to start replay:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current status of generators and replay')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const logGenerator = new LogGeneratorManager(options.config);
      
      const generatorStatus = logGenerator.getGeneratorStatus();
      const replayStatus = logGenerator.getReplayStatus();
      const historicalFiles = await logGenerator.getHistoricalFiles();

      console.log('\n=== Log Generator Status ===');
      console.log('Generators:');
      for (const [name, running] of Object.entries(generatorStatus)) {
        console.log(`  ${name}: ${running ? '🟢 Running' : '🔴 Stopped'}`);
      }

      console.log('\nReplay:');
      console.log(`  Status: ${replayStatus.isReplaying ? '🟢 Running' : '🔴 Stopped'}`);
      if (replayStatus.isReplaying) {
        console.log(`  Progress: ${replayStatus.currentIndex}/${replayStatus.totalLogs} (${replayStatus.progress.toFixed(1)}%)`);
      }

      console.log('\nHistorical Files:');
      if (historicalFiles.length === 0) {
        console.log('  No historical files found');
      } else {
        historicalFiles.slice(0, 10).forEach(file => {
          console.log(`  ${file.filename} - ${file.count} logs (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        });
        if (historicalFiles.length > 10) {
          console.log(`  ... and ${historicalFiles.length - 10} more files`);
        }
      }

    } catch (error) {
      logger.error('Failed to get status:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configuration management')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--show', 'Show current configuration')
  .option('--validate', 'Validate configuration file')
  .action(async (options) => {
    try {
      const logGenerator = new LogGeneratorManager(options.config);
      
      if (options.show) {
        const config = logGenerator.getConfig();
        console.log(JSON.stringify(config, null, 2));
      }

      if (options.validate) {
        console.log('✅ Configuration is valid');
      }

    } catch (error) {
      logger.error('Configuration error:', error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new configuration file')
  .option('-o, --output <path>', 'Output path for configuration file', './config.yaml')
  .action(async (options) => {
    try {
      const defaultConfigPath = path.join(__dirname, 'config', 'default.yaml');
      const outputPath = path.resolve(options.output);
      
      if (await fs.pathExists(outputPath)) {
        console.log(`Configuration file already exists at ${outputPath}`);
        return;
      }

      await fs.copy(defaultConfigPath, outputPath);
      console.log(`✅ Configuration file created at ${outputPath}`);
      console.log('Edit the configuration file to customize your log generation settings.');

    } catch (error) {
      logger.error('Failed to initialize configuration:', error);
      process.exit(1);
    }
  });

program.parse();
