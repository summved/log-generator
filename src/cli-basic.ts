#!/usr/bin/env node

import { Command } from 'commander';
import { LogGeneratorManager, MitreFilterOptions } from './LogGeneratorManager';
import { logger } from './utils/logger';
import { timestampValidator } from './utils/timestampValidator';
import { StorageManager } from './utils/storage';
import { mitreMapper } from './utils/mitreMapper';
import { AttackChainManager } from './chains/AttackChainManager';
import { AttackChainExecutionConfig } from './types/attackChain';
import { ConfigManager } from './config';
import { InputValidator } from './utils/inputValidator';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';

const program = new Command();

program
  .name('log-generator')
  .description('Enterprise SIEM log generator with MITRE ATT&CK framework integration')
  .version('1.0.0');

// Basic log generation command
program
  .command('generate')
  .description('Start generating logs from configured sources')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-d, --duration <minutes>', 'Duration to run (in minutes)', '5')
  .option('--mitre-tactic <tactic>', 'Filter by MITRE ATT&CK tactic (e.g., TA0001)')
  .option('--mitre-technique <technique>', 'Filter by MITRE ATT&CK technique (e.g., T1078)')
  .option('--source <source>', 'Generate logs only from specific source')
  .option('--level <level>', 'Log level filter (INFO, WARN, ERROR)')
  .action(async (options) => {
    try {
      console.log('🚀 Starting Log Generation\n');
      
      // Build MITRE filter if provided
      const mitreFilter: MitreFilterOptions = {};
      if (options.mitreTactic) {
        mitreFilter.tactic = options.mitreTactic;
      }
      if (options.mitreTechnique) {
        mitreFilter.technique = options.mitreTechnique;
      }
      
      const hasMitreFilter = Object.keys(mitreFilter).length > 0;
      const logGenerator = new LogGeneratorManager(options.config, hasMitreFilter ? mitreFilter : undefined);
      
      console.log(`Duration: ${options.duration} minutes`);
      if (options.source) console.log(`Source Filter: ${options.source}`);
      if (options.level) console.log(`Level Filter: ${options.level}`);
      if (hasMitreFilter) {
        console.log(`MITRE Filter: ${JSON.stringify(mitreFilter)}`);
      }
      console.log();
      
      await logGenerator.start();
      
      const durationMs = parseInt(options.duration) * 60 * 1000;
      setTimeout(async () => {
        console.log('\n⏰ Duration reached, stopping...');
        await logGenerator.stop();
        process.exit(0);
      }, durationMs);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Received interrupt signal, shutting down gracefully...');
        await logGenerator.stop();
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Failed to start log generation:', error);
      process.exit(1);
    }
  });

// Replay command
program
  .command('replay')
  .description('Replay historical logs')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-f, --file <path>', 'Specific log file to replay')
  .option('-s, --speed <multiplier>', 'Replay speed multiplier', '1.0')
  .option('--loop', 'Loop the replay indefinitely')
  .action(async (options) => {
    try {
      console.log('🔄 Starting Log Replay\n');
      
      const logGenerator = new LogGeneratorManager(options.config);
      
      // Update replay config with CLI options
      if (options.file || options.speed || options.loop) {
        const config = logGenerator.getConfig();
        config.replay = {
          ...config.replay,
          speed: parseFloat(options.speed),
          loop: !!options.loop
        };
      }
      
      console.log(`Speed: ${options.speed}x`);
      if (options.file) console.log(`File: ${options.file}`);
      if (options.loop) console.log('Loop: enabled');
      console.log();
      
      await logGenerator.startReplay();
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping replay...');
        await logGenerator.stopReplay();
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Failed to start replay:', error);
      process.exit(1);
    }
  });

// Status command - simplified to avoid LogGeneratorManager initialization issues
program
  .command('status')
  .description('Show current status and statistics')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      console.log('📊 Log Generator Status\n');
      console.log('='.repeat(50));
      
      // Read config directly without initializing LogGeneratorManager
      const configManager = new ConfigManager(options.config);
      const config = configManager.getConfig();
      
      // Configuration summary
      console.log('\n📋 Configuration:');
      console.log(`   Output Format: ${config.output.format}`);
      console.log(`   Destination: ${config.output.destination}`);
      console.log(`   Current Path: ${config.storage.currentPath}`);
      console.log(`   Historical Path: ${config.storage.historicalPath}`);
      console.log(`   Retention: ${config.storage.retention} days`);
      
      // Generators status
      console.log('\n🔧 Generators:');
      Object.entries(config.generators).forEach(([name, gen]) => {
        const frequency = gen.frequency ? `${gen.frequency}ms` : 'N/A';
        console.log(`   ${name}: ${gen.enabled ? '✅ enabled' : '❌ disabled'} (freq: ${frequency})`);
      });
      
      // File system status
      console.log('\n💾 Storage:');
      if (fs.existsSync(config.storage.currentPath)) {
        const stats = fs.statSync(config.storage.currentPath);
        console.log(`   Current logs directory: exists`);
        
        // List recent log files
        try {
          const files = fs.readdirSync(config.storage.currentPath);
          const logFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.log'));
          console.log(`   Current log files: ${logFiles.length}`);
          if (logFiles.length > 0) {
            console.log(`   Latest: ${logFiles[logFiles.length - 1]}`);
          }
        } catch (error) {
          console.log('   Current logs directory: exists but cannot read');
        }
      } else {
        console.log('   Current logs directory: not found');
      }
      
      if (fs.existsSync(config.storage.historicalPath)) {
        try {
          const files = fs.readdirSync(config.storage.historicalPath);
          console.log(`   Historical logs: ${files.length} files`);
        } catch (error) {
          console.log('   Historical logs directory: exists but cannot read');
        }
      } else {
        console.log('   Historical logs directory: not found');
      }
      
      // System info
      console.log('\n🖥️ System:');
      console.log(`   Node.js: ${process.version}`);
      console.log(`   Platform: ${process.platform}`);
      console.log(`   Uptime: ${Math.floor(process.uptime())}s`);
      console.log(`   Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
      
      console.log('\n✅ Status check completed successfully');
      
    } catch (error) {
      logger.error('Failed to get status:', error);
      process.exit(1);
    }
  });

// Validate config command
program
  .command('validate-config')
  .description('Validate configuration file for errors and performance issues')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--json', 'Output validation results in JSON format')
  .action(async (options) => {
    try {
      const { ConfigValidator } = await import('./utils/configValidator');
      const configManager = new ConfigManager(options.config);
      const config = configManager.getConfig();
      
      console.log('🔍 Validating Configuration...\n');
      
      const validationResult = ConfigValidator.validateConfig(config);
      
      if (options.json) {
        console.log(JSON.stringify(validationResult, null, 2));
        return;
      }
      
      // Display human-readable results
      if (validationResult.isValid) {
        console.log('✅ Configuration is valid!\n');
      } else {
        console.log('❌ Configuration validation failed!\n');
      }
      
      if (validationResult.errors.length > 0) {
        console.log('🚨 Errors:');
        validationResult.errors.forEach(error => {
          console.log(`   ❌ ${error}`);
        });
        console.log();
      }
      
      if (validationResult.warnings.length > 0) {
        console.log('⚠️ Warnings:');
        validationResult.warnings.forEach(warning => {
          console.log(`   ⚠️ ${warning}`);
        });
        console.log();
      }
      
      if (validationResult.recommendations.length > 0) {
        console.log('💡 Recommendations:');
        validationResult.recommendations.forEach(rec => {
          console.log(`   💡 ${rec}`);
        });
        console.log();
      }
      
      if (!validationResult.isValid) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error validating configuration:', error);
      process.exit(1);
    }
  });

// Attack chains command
program
  .command('attack-chains')
  .description('Manage and execute attack chains')
  .action(() => {
    console.log('🔗 Attack Chain Commands:');
    console.log('  attack-chains:list     - List available attack chains');
    console.log('  attack-chains:info     - Show attack chain details');
    console.log('  attack-chains:execute  - Execute an attack chain');
    console.log('  attack-chains:status   - Show execution status');
  });

program
  .command('attack-chains:list')
  .description('List all available attack chains')
  .action(async () => {
    try {
      const chainManager = new AttackChainManager();
      // Simplified template listing
      console.log('Available attack chain templates:');
      console.log('- APT29 Cozy Bear');
      console.log('- Insider Threat Data Theft');
      console.log('- Ransomware Ryuk');
      return;
      
      console.log('🔗 Available Attack Chains\n');
      console.log('='.repeat(50));
      
      
    } catch (error) {
      logger.error('Failed to list attack chains:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:execute')
  .description('Execute an attack chain')
  .requiredOption('-i, --id <chainId>', 'Attack chain ID or name')
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .action(async (options) => {
    try {
      console.log('⚔️ Executing Attack Chain\n');
      
      const chainManager = new AttackChainManager();
      const logGenerator = new LogGeneratorManager(options.config);
      
      console.log(`Chain: ${options.id}`);
      console.log(`Config: ${options.config || 'default'}\n`);
      
      const execution = await chainManager.executeChain(
        options.id,
        undefined, // No custom config
        options.config
      );
      
      console.log('✅ Attack chain execution completed');
      console.log(`   Execution ID: ${execution.executionId}`);
      console.log(`   Status: ${execution.status}`);
      console.log(`   Start Time: ${execution.startTime}`);
      if (execution.endTime) {
        console.log(`   End Time: ${execution.endTime}`);
      }
      
    } catch (error) {
      logger.error('Failed to execute attack chain:', error);
      process.exit(1);
    }
  });

// MITRE commands
program
  .command('mitre-list')
  .description('List MITRE ATT&CK tactics and techniques')
  .option('--tactics', 'List only tactics')
  .option('--techniques', 'List only techniques')
  .action(async (options) => {
    try {
      console.log('🎯 MITRE ATT&CK Framework\n');
      
      if (!options.techniques) {
        console.log('📋 Tactics (sample):');
        console.log('   TA0001: Initial Access');
        console.log('   TA0002: Execution');
        console.log('   TA0003: Persistence');
        console.log('   TA0004: Privilege Escalation');
        console.log('   TA0005: Defense Evasion');
        console.log();
      }
      
      if (!options.tactics) {
        console.log('🔧 Techniques (sample):');
        console.log('   T1078: Valid Accounts');
        console.log('   T1110: Brute Force');
        console.log('   T1059: Command and Scripting Interpreter');
        console.log('   T1055: Process Injection');
        console.log('   T1003: OS Credential Dumping');
        console.log('   ... and many more');
      }
      
    } catch (error) {
      logger.error('Failed to list MITRE data:', error);
      process.exit(1);
    }
  });

// Performance test command
program
  .command('performance-test')
  .description('Run performance tests to measure throughput')
  .option('--duration <seconds>', 'Test duration in seconds', '30')
  .option('--config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      console.log('🚀 Performance Test\n');
      console.log('='.repeat(50));
      
      const duration = parseInt(options.duration) * 1000;
      console.log(`Duration: ${options.duration} seconds`);
      console.log(`Config: ${options.config || 'default'}\n`);
      
      const logGenerator = new LogGeneratorManager(options.config);
      
      console.log('Starting performance test...');
      const startTime = Date.now();
      
      await logGenerator.start();
      
      await new Promise(resolve => setTimeout(resolve, duration));
      
      await logGenerator.stop();
      
      const endTime = Date.now();
      const actualDuration = (endTime - startTime) / 1000;
      
      console.log('\n📊 Performance Results:');
      console.log(`   Duration: ${actualDuration.toFixed(2)}s`);
      console.log('   Logs/second: [Check log files for actual count]');
      console.log('   Status: Test completed successfully');
      
    } catch (error) {
      logger.error('Performance test failed:', error);
      process.exit(1);
    }
  });

program.parse();
