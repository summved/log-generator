#!/usr/bin/env node

import { Command } from 'commander';
import { LogGeneratorManager, MitreFilterOptions } from './LogGeneratorManager';
import { logger } from './utils/logger';
import { timestampValidator } from './utils/timestampValidator';
import { StorageManager } from './utils/storage';
import { mitreMapper } from './utils/mitreMapper';
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
  .option('--mitre-technique <technique>', 'Generate logs only for specific MITRE technique (e.g., T1110)')
  .option('--mitre-tactic <tactic>', 'Generate logs only for specific MITRE tactic (e.g., TA0006)')
  .option('--mitre-enabled', 'Generate only logs with MITRE technique mapping')
  .action(async (options) => {
    try {
      // Build MITRE filter options
      const mitreFilter: MitreFilterOptions = {};
      
      if (options.mitreTechnique) {
        if (!mitreMapper.isValidTechnique(options.mitreTechnique)) {
          console.error(`Invalid MITRE technique: ${options.mitreTechnique}`);
          console.error('Example valid techniques: T1110, T1078, T1562.001');
          process.exit(1);
        }
        mitreFilter.technique = options.mitreTechnique;
        logger.info(`Filtering logs for MITRE technique: ${options.mitreTechnique}`);
      }
      
      if (options.mitreTactic) {
        if (!mitreMapper.isValidTactic(options.mitreTactic)) {
          console.error(`Invalid MITRE tactic: ${options.mitreTactic}`);
          console.error('Example valid tactics: TA0001, TA0006, TA0005');
          process.exit(1);
        }
        mitreFilter.tactic = options.mitreTactic;
        logger.info(`Filtering logs for MITRE tactic: ${options.mitreTactic} (${mitreMapper.getTacticName(options.mitreTactic)})`);
      }
      
      if (options.mitreEnabled) {
        mitreFilter.enabledOnly = true;
        logger.info('Generating only logs with MITRE technique mapping');
      }
      
      const hasMitreFilter = Object.keys(mitreFilter).length > 0;
      const logGenerator = new LogGeneratorManager(options.config, hasMitreFilter ? mitreFilter : undefined);
      
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

program
  .command('analyze')
  .description('Analyze historical log files for timestamp issues')
  .option('-f, --file <filename>', 'Specific historical file to analyze')
  .option('--fix', 'Fix duplicate timestamps in historical files')
  .action(async (options) => {
    try {
      const storageManager = new StorageManager('./logs/current', './logs/historical', 30);
      
      if (options.file) {
        // Analyze specific file
        console.log(`\n🔍 Analyzing historical file: ${options.file}`);
        const logs = await storageManager.readHistoricalLogs(options.file);
        
        const validation = timestampValidator.validateTimestamps(logs);
        const analysis = timestampValidator.analyzeTimestampPatterns(logs);
        
        console.log(`\n📊 Analysis Results:`);
        console.log(`  Total logs: ${analysis.totalLogs}`);
        console.log(`  Time span: ${analysis.timeSpan}`);
        console.log(`  Average interval: ${analysis.averageInterval.toFixed(2)}ms`);
        console.log(`  Duplicate timestamps: ${validation.duplicateCount}`);
        console.log(`  Invalid timestamps: ${validation.invalidCount}`);
        
        if (analysis.duplicateGroups.length > 0) {
          console.log(`\n⚠️  Duplicate timestamp groups:`);
          analysis.duplicateGroups.slice(0, 10).forEach(group => {
            console.log(`    ${group.timestamp}: ${group.count} occurrences`);
          });
          if (analysis.duplicateGroups.length > 10) {
            console.log(`    ... and ${analysis.duplicateGroups.length - 10} more groups`);
          }
        }
        
        if (options.fix && validation.duplicateCount > 0) {
          console.log(`\n🔧 Fixing duplicate timestamps...`);
          const { fixedLogs, fixedCount } = timestampValidator.fixDuplicateTimestamps(logs);
          
          // Write fixed logs back to file
          const fixedFilename = options.file.replace(/\.jsonl$/, '_fixed.jsonl');
          await storageManager.storeLogs(fixedLogs, fixedFilename);
          
          console.log(`✅ Fixed ${fixedCount} duplicate timestamps`);
          console.log(`📁 Fixed logs saved to: ${fixedFilename}`);
        }
        
      } else {
        // Analyze all historical files
        console.log(`\n🔍 Analyzing all historical files...`);
        const historicalFiles = await storageManager.getHistoricalLogFiles();
        
        let totalDuplicates = 0;
        let totalInvalid = 0;
        let filesWithIssues = 0;
        
        for (const file of historicalFiles.slice(0, 10)) { // Limit to 10 files for performance
          const logs = await storageManager.readHistoricalLogs(file.filename);
          const validation = timestampValidator.validateTimestamps(logs);
          
          if (!validation.isValid) {
            filesWithIssues++;
            totalDuplicates += validation.duplicateCount;
            totalInvalid += validation.invalidCount;
            
            console.log(`  ⚠️  ${file.filename}: ${validation.duplicateCount} duplicates, ${validation.invalidCount} invalid`);
          }
        }
        
        if (filesWithIssues === 0) {
          console.log(`✅ No timestamp issues found in analyzed files`);
        } else {
          console.log(`\n📊 Summary:`);
          console.log(`  Files with issues: ${filesWithIssues}/${Math.min(historicalFiles.length, 10)}`);
          console.log(`  Total duplicates: ${totalDuplicates}`);
          console.log(`  Total invalid: ${totalInvalid}`);
          console.log(`\n💡 Use --fix flag to automatically fix duplicate timestamps`);
        }
      }
      
    } catch (error) {
      logger.error('Failed to analyze historical data:', error);
      process.exit(1);
    }
  });

// MITRE ATT&CK Commands
program
  .command('mitre-list')
  .description('List supported MITRE ATT&CK techniques and tactics')
  .option('--techniques', 'List all supported techniques')
  .option('--tactics', 'List all supported tactics')
  .action(async (options) => {
    try {
      console.log('\n🎯 MITRE ATT&CK Support Information\n');
      
      if (options.techniques || (!options.techniques && !options.tactics)) {
        console.log('📋 Supported MITRE Techniques:');
        const techniques = mitreMapper.getSupportedTechniques();
        const uniqueTechniques = [...new Set(techniques)].sort();
        
        for (const technique of uniqueTechniques) {
          const info = mitreMapper.getTechniqueInfo(technique);
          if (info) {
            console.log(`  ✅ ${technique} - ${info.subtechnique || 'Unknown'}`);
            console.log(`     ${info.description}`);
          }
        }
        console.log(`\n📊 Total: ${uniqueTechniques.length} techniques supported\n`);
      }
      
      if (options.tactics || (!options.techniques && !options.tactics)) {
        console.log('🎯 Supported MITRE Tactics:');
        const tactics = mitreMapper.getSupportedTactics();
        
        for (const tactic of tactics) {
          const name = mitreMapper.getTacticName(tactic);
          console.log(`  ✅ ${tactic} - ${name}`);
        }
        console.log(`\n📊 Total: ${tactics.length} tactics supported\n`);
      }
      
    } catch (error) {
      console.error('❌ Error listing MITRE information:', error);
      process.exit(1);
    }
  });

program
  .command('mitre-coverage')
  .description('Analyze MITRE ATT&CK coverage in historical logs')
  .option('-f, --file <filename>', 'Specific historical file to analyze')
  .action(async (options) => {
    try {
      const storageManager = new StorageManager('./logs/current', './logs/historical', 30);
      
      console.log('\n🔍 MITRE ATT&CK Coverage Analysis\n');
      
      let allLogs: any[] = [];
      
      if (options.file) {
        console.log(`📁 Analyzing file: ${options.file}`);
        allLogs = await storageManager.readHistoricalLogs(options.file);
      } else {
        console.log('📁 Analyzing all historical files...');
        const historicalFiles = await storageManager.getHistoricalLogFiles();
        
        for (const file of historicalFiles.slice(0, 5)) { // Limit for performance
          const logs = await storageManager.readHistoricalLogs(file.filename);
          allLogs.push(...logs);
        }
      }
      
      if (allLogs.length === 0) {
        console.log('⚠️  No logs found to analyze');
        return;
      }
      
      // Analyze MITRE coverage
      const mitreStats = {
        totalLogs: allLogs.length,
        logsWithMitre: 0,
        techniques: new Map<string, number>(),
        tactics: new Map<string, number>()
      };
      
      for (const log of allLogs) {
        if (log.mitre) {
          mitreStats.logsWithMitre++;
          
          // Count techniques
          const technique = log.mitre.technique;
          mitreStats.techniques.set(technique, (mitreStats.techniques.get(technique) || 0) + 1);
          
          // Count tactics
          const tactic = log.mitre.tactic;
          mitreStats.tactics.set(tactic, (mitreStats.tactics.get(tactic) || 0) + 1);
        }
      }
      
      // Display results
      console.log('📊 MITRE Coverage Summary:');
      console.log(`   Total logs analyzed: ${mitreStats.totalLogs}`);
      console.log(`   Logs with MITRE data: ${mitreStats.logsWithMitre} (${((mitreStats.logsWithMitre / mitreStats.totalLogs) * 100).toFixed(1)}%)`);
      console.log(`   Unique techniques found: ${mitreStats.techniques.size}`);
      console.log(`   Unique tactics found: ${mitreStats.tactics.size}\n`);
      
      if (mitreStats.techniques.size > 0) {
        console.log('🎯 Top MITRE Techniques:');
        const sortedTechniques = Array.from(mitreStats.techniques.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10);
          
        for (const [technique, count] of sortedTechniques) {
          const info = mitreMapper.getTechniqueInfo(technique);
          const percentage = ((count / mitreStats.logsWithMitre) * 100).toFixed(1);
          console.log(`   ${technique}: ${count} logs (${percentage}%) - ${info?.subtechnique || 'Unknown'}`);
        }
        console.log();
      }
      
      if (mitreStats.tactics.size > 0) {
        console.log('🏹 MITRE Tactics Distribution:');
        const sortedTactics = Array.from(mitreStats.tactics.entries())
          .sort(([,a], [,b]) => b - a);
          
        for (const [tactic, count] of sortedTactics) {
          const name = mitreMapper.getTacticName(tactic);
          const percentage = ((count / mitreStats.logsWithMitre) * 100).toFixed(1);
          console.log(`   ${tactic} (${name}): ${count} logs (${percentage}%)`);
        }
        console.log();
      }
      
    } catch (error) {
      console.error('❌ Error analyzing MITRE coverage:', error);
      process.exit(1);
    }
  });

program.parse();
