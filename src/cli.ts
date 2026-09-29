#!/usr/bin/env node

import { Command } from 'commander';
import { LogGeneratorManager, MitreFilterOptions } from './LogGeneratorManager';
import { logger } from './utils/logger';
import { timestampValidator } from './utils/timestampValidator';
import { StorageManager } from './utils/storage';
import { mitreMapper } from './utils/mitreMapper';
import { AttackChainManager } from './chains/AttackChainManager';
import { chainDurationMs, speedForTargetDuration } from './chains/chainTiming';
import { analyzeD3fendCoverage, listD3fendTechniques } from './utils/d3fendCoverage';
import { LogFilesResult, readLogFiles } from './utils/logFiles';
import { AutoForecast, bucketByWindow, detectVolumeAnomalies, forecastAuto, forecastSeasonal, forecastVolume, rareValues, RareValue } from './ml/volumeAnalysis';
import { detectLogOutliers } from './ml/logOutliers';
import { extractIndicators, matchIndicators, parseIndicatorList } from './ml/indicators';
import { ClassifierLabel, loadTextClassifier, trainTextClassifier } from './ml/logTextClassifier';
import { AttackChainExecutionConfig } from './types/attackChain';
import { EnhancedAttackChainManager } from './stubs/WorkingAIFeatures';
import { buildProfile, generateFromProfile, loadProfile, saveProfile } from './ml/logProfile';
import { analyzeLogs } from './ml/logAnalysis';
import { DEFAULT_SETTINGS, DEFAULT_SETTINGS_PATH, loadSettings, mergeSettingsFile, MlSettings, saveSettings, setSetting } from './ml/mlSettings';
import { LogFormatters } from './utils/formatters';
import { LogEntry } from './types';
import { ConfigManager } from './config';
import { InputValidator } from './utils/inputValidator';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';

// Helper functions for config management
async function setConfigValue(key: string, value: string): Promise<void> {
  // Validate and sanitize input
  const validated = InputValidator.validateConfigKeyValue(key, value);
  
  const configPath = InputValidator.validateFilePath('src/config/default.yaml');
  const configContent = await fs.readFile(configPath, 'utf8');
  const config = yaml.parse(configContent);
  
  // Parse the key path (e.g., "generators.endpoint.frequency")
  const keyParts = validated.key.split('.');
  let current = config;
  
  // Navigate to the parent object
  for (let i = 0; i < keyParts.length - 1; i++) {
    if (!current[keyParts[i]]) {
      current[keyParts[i]] = {};
    }
    current = current[keyParts[i]];
  }
  
  // Set the value (convert to appropriate type)
  const finalKey = keyParts[keyParts.length - 1];
  let parsedValue: any = value;
  
  // Try to parse as number
  if (!isNaN(Number(value))) {
    parsedValue = Number(value);
  }
  // Try to parse as boolean
  else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    parsedValue = value.toLowerCase() === 'true';
  }
  
  current[finalKey] = parsedValue;
  
  // Write back to file
  const newConfigContent = yaml.stringify(config, { indent: 2 });
  await fs.writeFile(configPath, newConfigContent);
}

function getConfigValue(config: any, key: string): any {
  const keyParts = key.split('.');
  let current = config;
  
  for (const part of keyParts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

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
  .option('--duration <time>', 'Duration to run generation (e.g., 30m, 1h, 2h30m)')
  .option('--mitre-technique <technique>', 'Generate logs only for specific MITRE technique (e.g., T1110)')
  .option('--mitre-tactic <tactic>', 'Generate logs only for specific MITRE tactic (e.g., TA0006)')
  .option('--mitre-enabled', 'Generate only logs with MITRE technique mapping')
  .action(async (options) => {
    try {
      // Parse duration if provided
      let durationMs: number | undefined;
      if (options.duration) {
        const parsed = parseDuration(options.duration);
        if (!parsed) {
          console.error(`Invalid duration format: ${options.duration}`);
          console.error('Example valid formats: 30m, 1h, 2h30m, 90s');
          process.exit(1);
        }
        durationMs = parsed;
        logger.info(`Generation will run for ${options.duration} (${durationMs}ms)`);
      }

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
        if (durationMs) {
          console.log(`Log generator is running for ${options.duration}. Press Ctrl+C to stop early.`);
          // Set timeout to stop after specified duration
          setTimeout(async () => {
            logger.info(`Duration ${options.duration} completed, stopping log generation`);
            await logGenerator.stop();
            process.exit(0);
          }, durationMs);
          // Keep the process running until timeout
          await new Promise(() => {});
        } else {
          console.log('Log generator is running. Press Ctrl+C to stop.');
          // Keep the process running
          await new Promise(() => {});
        }
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
  .option('-b, --batch-size <size>', 'Batch size for high-performance replay (1=single, 100+=batch)', parseInt)
  .option('-l, --loop', 'Loop replay continuously')
  .option('--start-time <timestamp>', 'Start time for replay (ISO format)')
  .option('--end-time <timestamp>', 'End time for replay (ISO format)')
  .action(async (options) => {
    try {
      const logGenerator = new LogGeneratorManager(options.config);
      
      // Update replay config with CLI options
      if (options.speed || options.loop || options.startTime || options.endTime || options.batchSize) {
        const config = logGenerator.getConfig();
        const replayConfig = {
          ...config.replay,
          enabled: true,
          ...(options.speed && { speed: options.speed }),
          ...(options.batchSize && { batchSize: options.batchSize }),
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
      }, 2000); // Reduced from 5000ms to 2000ms for more frequent updates

    } catch (error) {
      logger.error('Failed to start replay:', error);
      process.exit(1);
    }
  });

program
  .command('validate-config')
  .description('Validate configuration file for errors and performance issues')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--json', 'Output validation results in JSON format')
  .action(async (options) => {
    try {
      const { ConfigValidator } = await import('./utils/configValidator');
      const { ConfigManager } = await import('./config');
      
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
        validationResult.recommendations.forEach((rec: any) => {
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

      // Clean up resources and exit
      await logGenerator.stop();
      process.exit(0);

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
  .option('--set <key=value>', 'Set configuration value (e.g., generators.endpoint.frequency=20)')
  .option('--get <key>', 'Get configuration value (e.g., generators.endpoint.frequency)')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager(options.config);
      
      if (options.show) {
        const config = configManager.getConfig();
        console.log(JSON.stringify(config, null, 2));
      }

      if (options.validate) {
        console.log('✅ Configuration is valid');
      }

      if (options.set) {
        const [key, value] = options.set.split('=');
        if (!key || value === undefined) {
          console.error('❌ Invalid format. Use: --set key=value');
          process.exit(1);
        }
        
        await setConfigValue(key.trim(), value.trim());
        console.log(`✅ Set ${key} = ${value}`);
      }

      if (options.get) {
        const value = getConfigValue(configManager.getConfig(), options.get);
        console.log(value !== undefined ? value : `❌ Key not found: ${options.get}`);
      }

      // Clean up and exit
      process.exit(0);

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

// Attack Chain Commands
program
  .command('attack-chains')
  .description('Manage and execute attack chain simulations')
  .action(() => {
    console.log('🔗 Attack Chain Management');
    console.log('Available subcommands:');
    console.log('  list           - List available attack chain templates');
    console.log('  info <name>    - Show detailed information about an attack chain');
    console.log('  execute <name> - Execute an attack chain simulation');
    console.log('  status         - Show status of running attack chains');
    console.log('  abort <id>     - Abort a running attack chain');
    console.log('  coverage       - Show MITRE technique coverage across all chains');
    console.log('');
    console.log('🤖 AI-Enhanced Commands:');
    console.log('  execute-ai <name>  - Execute chain with AI enhancements');
    console.log('  training <name>    - Run training session with multiple variations');
    console.log('  preview <name>     - Preview AI enhancements without execution');
    console.log('  ai-options <name>  - Show available AI enhancement options');
    console.log('  ai-statistics      - Show AI enhancement execution statistics');
    console.log('\nExample: npm run attack-chains:execute-ai ransomware-ryuk --mode enhanced --ai-level medium');
  });

program
  .command('attack-chains:list')
  .description('List all available attack chain templates')
  .option('--category <category>', 'Filter by category (apt, ransomware, insider_threat)')
  .option('--difficulty <level>', 'Filter by difficulty (beginner, intermediate, advanced, expert)')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const chainManager = new AttackChainManager();
      let templates = chainManager.getTemplates();

      // Apply filters
      if (options.category) {
        templates = templates.filter(t => t.category === options.category);
      }
      
      if (options.difficulty) {
        templates = templates.filter(t => t.difficulty === options.difficulty);
      }

      if (options.json) {
        console.log(JSON.stringify(templates, null, 2));
        return;
      }

      console.log('🔗 Available Attack Chain Templates:\n');
      
      if (templates.length === 0) {
        console.log('No attack chain templates found matching the criteria.');
        return;
      }

      for (const template of templates) {
        const chain = template.chain;
        console.log(`📋 ${template.name}`);
        console.log(`   ID: ${chain.id}`);
        console.log(`   Category: ${template.category.toUpperCase()}`);
        console.log(`   Difficulty: ${template.difficulty.toUpperCase()}`);
        console.log(`   Steps: ${chain.steps.length}`);
        console.log(`   Estimated Duration: ${chain.metadata.estimated_duration} minutes`);
        console.log(`   MITRE Techniques: ${chain.mitre_mapping.techniques.length}`);
        console.log(`   Description: ${template.description}`);
        console.log('');
      }

      // Show statistics
      const stats = chainManager.getStatistics();
      console.log('📊 Statistics:');
      console.log(`   Total Templates: ${stats.totalTemplates}`);
      console.log(`   Categories: ${Object.keys(stats.categoryCounts).join(', ')}`);
      console.log(`   Average Steps: ${stats.averageSteps}`);
      console.log(`   Average Duration: ${stats.averageDuration} minutes`);

    } catch (error) {
      console.error('❌ Error listing attack chains:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:info')
  .description('Show detailed information about a specific attack chain')
  .argument('<name>', 'Attack chain name or ID')
  .option('--json', 'Output in JSON format')
  .action(async (name, options) => {
    try {
      const chainManager = new AttackChainManager();
      const template = chainManager.getTemplateByName(name) || chainManager.getTemplate(name);
      
      if (!template) {
        console.error(`❌ Attack chain not found: ${name}`);
        console.error('Use "npm run attack-chains:list" to see available chains');
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(template, null, 2));
        return;
      }

      const chain = template.chain;
      
      console.log(`🔗 ${template.name}\n`);
      console.log(`📋 Overview:`);
      console.log(`   ID: ${chain.id}`);
      console.log(`   Category: ${template.category.toUpperCase()}`);
      console.log(`   Difficulty: ${template.difficulty.toUpperCase()}`);
      console.log(`   Author: ${chain.metadata.author}`);
      console.log(`   Version: ${chain.metadata.version}`);
      console.log(`   Severity: ${chain.metadata.severity.toUpperCase()}`);
      console.log(`   Tags: ${chain.metadata.tags.join(', ')}`);
      console.log(`   Estimated Duration: ${chain.metadata.estimated_duration} minutes\n`);
      
      console.log(`📝 Description:`);
      console.log(`   ${template.description}\n`);
      
      console.log(`🎯 Use Cases:`);
      for (const useCase of template.use_cases) {
        console.log(`   • ${useCase}`);
      }
      console.log();
      
      console.log(`🏹 MITRE ATT&CK Mapping:`);
      console.log(`   Tactics (${chain.mitre_mapping.tactics.length}): ${chain.mitre_mapping.tactics.join(', ')}`);
      console.log(`   Techniques (${chain.mitre_mapping.techniques.length}): ${chain.mitre_mapping.techniques.join(', ')}`);
      console.log(`   Kill Chain Phases: ${chain.mitre_mapping.kill_chain_phases.join(', ')}\n`);
      
      console.log(`⚙️ Configuration:`);
      console.log(`   Max Duration: ${Math.round(chain.config.max_duration / 60000)} minutes`);
      console.log(`   Abort on Step Failure: ${chain.config.abort_on_step_failure}`);
      console.log(`   Log Progress: ${chain.config.log_chain_progress}`);
      console.log(`   Cleanup After Completion: ${chain.config.cleanup_after_completion}\n`);
      
      console.log(`🔄 Attack Steps (${chain.steps.length}):`);
      for (const [index, step] of chain.steps.entries()) {
        const duration = Math.round(step.timing.duration / 1000);
        const delay = Math.round(step.timing.delayAfterPrevious / 1000);
        
        console.log(`   ${index + 1}. ${step.name}`);
        console.log(`      MITRE: ${step.mitre.technique} (${step.mitre.subtechnique})`);
        console.log(`      Duration: ${duration}s, Delay: ${delay}s, Frequency: ${step.logGeneration.frequency} logs/min`);
        console.log(`      Sources: ${step.logGeneration.sources.join(', ')}`);
        if (step.dependencies && step.dependencies.length > 0) {
          console.log(`      Dependencies: ${step.dependencies.join(', ')}`);
        }
        console.log(`      ${step.description}`);
        console.log('');
      }

      // Validate prerequisites
      const validation = chainManager.validateExecutionPrerequisites(chain.id);
      console.log(`✅ Execution Validation:`);
      console.log(`   Valid: ${validation.valid ? '✅ YES' : '❌ NO'}`);
      
      if (validation.issues.length > 0) {
        console.log(`   Issues:`);
        for (const issue of validation.issues) {
          console.log(`     ❌ ${issue}`);
        }
      }
      
      if (validation.warnings.length > 0) {
        console.log(`   Warnings:`);
        for (const warning of validation.warnings) {
          console.log(`     ⚠️ ${warning}`);
        }
      }

    } catch (error) {
      console.error('❌ Error getting attack chain info:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:execute')
  .description('Execute an attack chain simulation')
  .argument('<name>', 'Attack chain name or ID')
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .option('--speed <multiplier>', 'Speed multiplier (0.5 = half speed, 2.0 = double speed; default 1)')
  .option('--duration <time>', 'Fit the whole chain into this wall-clock time, e.g. 10m or 90s (instead of --speed)')
  .option('--output-dir <path>', 'Output directory for logs and reports')
  .option('--continue-on-failure', 'Continue execution even if steps fail')
  .option('--no-randomize-timing', 'Disable timing randomization')
  .option('--no-progress-logging', 'Disable progress logging')
  .option('--no-report', 'Skip generating execution report')
  .action(async (name, options) => {
    try {
      const chainManager = new AttackChainManager();
      const template = chainManager.getTemplateByName(name) || chainManager.getTemplate(name);
      
      if (!template) {
        console.error(`❌ Attack chain not found: ${name}`);
        console.error('Use "npm run attack-chains:list" to see available chains');
        process.exit(1);
      }

      // Validate prerequisites
      const validation = chainManager.validateExecutionPrerequisites(template.chain.id);
      if (!validation.valid) {
        console.error(`❌ Cannot execute attack chain due to validation issues:`);
        for (const issue of validation.issues) {
          console.error(`   • ${issue}`);
        }
        process.exit(1);
      }

      if (validation.warnings.length > 0) {
        console.log(`⚠️ Warnings:`);
        for (const warning of validation.warnings) {
          console.log(`   • ${warning}`);
        }
        console.log();
      }

      // Resolve speed: explicit --speed, or the speed that fits the chain into --duration
      if (options.speed !== undefined && options.duration !== undefined) {
        console.error('❌ Use either --speed or --duration, not both');
        process.exit(1);
      }
      let speedMultiplier = options.speed !== undefined ? parseFloat(options.speed) : 1;
      if (options.duration !== undefined) {
        const targetMs = parseDuration(options.duration);
        if (!targetMs) {
          console.error(`❌ Invalid --duration "${options.duration}". Use formats like 10m, 90s or 1h30m`);
          process.exit(1);
        }
        speedMultiplier = speedForTargetDuration(template.chain.steps, targetMs);
      }
      if (!(speedMultiplier > 0)) {
        console.error(`❌ Invalid --speed "${options.speed}". Use a number greater than 0`);
        process.exit(1);
      }

      // Build execution configuration
      const executionConfig: Partial<AttackChainExecutionConfig> = {
        speed_multiplier: speedMultiplier,
        enable_progress_logging: options.progressLogging !== false,
        continue_on_failure: options.continueOnFailure || false,
        randomize_timing: options.randomizeTiming !== false,
        generate_execution_report: options.report !== false,
        output_directory: options.outputDir
      };

      console.log(`🚀 Starting attack chain execution: ${template.name}`);
      console.log(`   Category: ${template.category.toUpperCase()}`);
      console.log(`   Steps: ${template.chain.steps.length}`);
      const estimatedMinutes = chainDurationMs(template.chain.steps) / speedMultiplier / 60000;
      console.log(`   Estimated Duration: ${estimatedMinutes >= 1 ? `${Math.round(estimatedMinutes)} minutes` : `${Math.round(estimatedMinutes * 60)} seconds`}`);
      console.log(`   Speed Multiplier: ${Number(speedMultiplier.toFixed(2))}x`);
      console.log();

      const execution = await chainManager.executeChain(
        template.chain.id,
        executionConfig,
        options.config
      );

      console.log(`✅ Attack chain execution completed!`);
      console.log(`   Execution ID: ${execution.executionId}`);
      console.log(`   Status: ${execution.status.toUpperCase()}`);
      console.log(`   Steps Completed: ${execution.stats.stepsCompleted}/${execution.totalSteps}`);
      console.log(`   Steps Failed: ${execution.stats.stepsFailed}`);
      console.log(`   Total Logs Generated: ${execution.stats.logsGenerated}`);
      
      if (execution.startTime && execution.endTime) {
        const duration = Math.round((execution.endTime.getTime() - execution.startTime.getTime()) / 1000);
        console.log(`   Actual Duration: ${Math.round(duration / 60)} minutes ${duration % 60} seconds`);
      }

      if (execution.lastError) {
        console.log(`   Last Error: ${execution.lastError.message} (Step: ${execution.lastError.stepId})`);
      }

      for (const logFile of execution.outputFiles?.logs || []) {
        console.log(`   Log File: ${logFile}`);
      }
      if (execution.outputFiles?.report) {
        console.log(`   Report: ${execution.outputFiles.report}`);
      }

      // Explicitly exit to prevent hanging due to lingering timers/handles
      process.exit(0);

    } catch (error) {
      console.error('❌ Error executing attack chain:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:status')
  .description('Show status of running attack chains')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const chainManager = new AttackChainManager();
      const executions = chainManager.getActiveExecutions();

      if (options.json) {
        console.log(JSON.stringify(executions, null, 2));
        return;
      }

      if (executions.length === 0) {
        console.log('No active attack chain executions found.');
        return;
      }

      console.log('🔄 Active Attack Chain Executions:\n');
      
      for (const execution of executions) {
        console.log(`📋 Execution: ${execution.executionId}`);
        console.log(`   Chain: ${execution.chainId}`);
        console.log(`   Status: ${execution.status.toUpperCase()}`);
        console.log(`   Progress: ${execution.completedSteps.length}/${execution.totalSteps} steps`);
        
        if (execution.currentStep) {
          console.log(`   Current Step: ${execution.currentStep}`);
        }
        
        if (execution.startTime) {
          const elapsed = Math.round((Date.now() - execution.startTime.getTime()) / 1000);
          console.log(`   Elapsed Time: ${Math.round(elapsed / 60)}m ${elapsed % 60}s`);
        }
        
        if (execution.estimatedEndTime) {
          const remaining = Math.round((execution.estimatedEndTime.getTime() - Date.now()) / 1000);
          if (remaining > 0) {
            console.log(`   Estimated Remaining: ${Math.round(remaining / 60)}m ${remaining % 60}s`);
          }
        }
        
        console.log(`   Logs Generated: ${execution.stats.logsGenerated}`);
        
        if (execution.lastError) {
          console.log(`   Last Error: ${execution.lastError.message}`);
        }
        
        console.log('');
      }

    } catch (error) {
      console.error('❌ Error getting attack chain status:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:abort')
  .description('Abort a running attack chain execution')
  .argument('<executionId>', 'Execution ID to abort')
  .action(async (executionId) => {
    try {
      const chainManager = new AttackChainManager();
      
      const execution = chainManager.getExecutionStatus(executionId);
      if (!execution) {
        console.error(`❌ No active execution found with ID: ${executionId}`);
        process.exit(1);
      }

      console.log(`🛑 Aborting attack chain execution: ${executionId}`);
      console.log(`   Chain: ${execution.chainId}`);
      console.log(`   Current Status: ${execution.status.toUpperCase()}`);
      
      await chainManager.abortExecution(executionId);
      
      console.log(`✅ Attack chain execution aborted successfully`);

    } catch (error) {
      console.error('❌ Error aborting attack chain:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:coverage')
  .description('Show MITRE ATT&CK technique coverage across all attack chains')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const chainManager = new AttackChainManager();
      const coverage = chainManager.getMitreCoverage();
      const stats = chainManager.getStatistics();

      if (options.json) {
        console.log(JSON.stringify({ coverage, stats }, null, 2));
        return;
      }

      console.log('🎯 MITRE ATT&CK Coverage Analysis\n');
      
      console.log('📊 Overall Coverage:');
      console.log(`   Total Attack Chains: ${stats.totalTemplates}`);
      console.log(`   MITRE Techniques Covered: ${coverage.techniqueCount}`);
      console.log(`   MITRE Tactics Covered: ${coverage.tacticCount}`);
      console.log();
      
      console.log('🏹 Tactics Coverage:');
      for (const tactic of coverage.tactics) {
        const name = mitreMapper.getTacticName(tactic);
        console.log(`   ${tactic}: ${name}`);
      }
      console.log();
      
      console.log('🎯 Techniques Coverage:');
      const sortedTechniques = coverage.techniques.sort();
      const chunkedTechniques = [];
      for (let i = 0; i < sortedTechniques.length; i += 5) {
        chunkedTechniques.push(sortedTechniques.slice(i, i + 5));
      }
      
      for (const chunk of chunkedTechniques) {
        console.log(`   ${chunk.join('   ')}`);
      }
      console.log();
      
      console.log('📈 Category Breakdown:');
      for (const [category, count] of Object.entries(stats.categoryCounts)) {
        console.log(`   ${category.toUpperCase()}: ${count} chains`);
      }
      console.log();
      
      console.log('⚡ Difficulty Distribution:');
      for (const [difficulty, count] of Object.entries(stats.difficultyCounts)) {
        console.log(`   ${difficulty.toUpperCase()}: ${count} chains`);
      }

    } catch (error) {
      console.error('❌ Error analyzing attack chain coverage:', error);
      process.exit(1);
    }
  });

// AI-Enhanced Attack Chain Commands
program
  .command('attack-chains:execute-ai')
  .description('Execute attack chain with AI enhancements')
  .argument('<name>', 'Attack chain name or ID')
  .option('--mode <mode>', 'Enhancement mode: static, enhanced, dynamic', 'static')
  .option('--ai-level <level>', 'AI level: basic, medium, high, advanced', 'basic')
  .option('--variations <count>', 'Number of variations to generate', '1')
  .option('--enable-evasion', 'Enable evasion tactics')
  .option('--adaptive-delays', 'Enable adaptive timing delays')
  .option('--full-execution', 'Run full attack chain execution (may take 45+ minutes)')
  .option('--simulation', 'Run in simulation mode (instant; describes the enhancements, writes no logs)', true)
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .action(async (name, options) => {
    try {
      console.log(`🤖 Starting AI-Enhanced Attack Chain: ${name}\n`);
      
      const enhancedManager = new EnhancedAttackChainManager();
      
      // Determine execution mode
      const useFullExecution = options.fullExecution || !options.simulation;
      
      const enhancementOptions = {
        mode: options.mode,
        aiLevel: options.aiLevel,
        variations: parseInt(options.variations),
        enableEvasion: options.enableEvasion,
        adaptiveDelays: options.adaptiveDelays,
        simulation: !useFullExecution,
        config: options.config
      };

      console.log(`⚙️ Enhancement Configuration:`);
      console.log(`   Execution Mode: ${useFullExecution ? '⚡ FULL EXECUTION (may take 45+ minutes)' : '🚀 SIMULATION (instant, writes no logs)'}`);
      console.log(`   AI Mode: ${enhancementOptions.mode}`);
      console.log(`   AI Level: ${enhancementOptions.aiLevel}`);
      console.log(`   Variations: ${enhancementOptions.variations}`);
      console.log(`   Evasion Tactics: ${enhancementOptions.enableEvasion ? 'Enabled' : 'Disabled'}`);
      console.log(`   Adaptive Delays: ${enhancementOptions.adaptiveDelays ? 'Enabled' : 'Disabled'}`);
      
      if (useFullExecution) {
        console.log(`\n⚠️  WARNING: Full execution mode selected!`);
        console.log(`   This will run the complete attack chain simulation which may take 45+ minutes.`);
        console.log(`   Use --simulation for an instant preview that writes no logs.`);
      }
      console.log();

      const execution = await enhancedManager.executeEnhancedChain(name, enhancementOptions);

      console.log(`\n✅ AI-Enhanced Execution Completed!`);
      console.log(`   Execution Mode: ${execution.executionMode === 'simulation' ? '🚀 SIMULATION' : '⚡ FULL EXECUTION'}`);
      console.log(`   Execution ID: ${execution.executionId || 'N/A'}`);
      console.log(`   Status: ${execution.status || 'completed'}`);
      if (execution.executionMode === 'simulation') {
        console.log(`   Logs Written: 0 (simulation writes no logs; a full run of this chain writes ~${execution.stats.estimatedLogs})`);
        console.log(`   For real logs: npm run attack-chains:execute ${name} -- --duration 5m`);
      } else {
        console.log(`   Logs Generated: ${execution.stats.logsGenerated}`);
      }
      console.log(`   Steps: ${execution.stats.stepsCompleted}`);
      console.log(`   Planned changes for this mode/level: ${execution.stats.enhancementsApplied || 0}`);

      if (execution.aiEnhancements && execution.aiEnhancements.length > 0) {
        console.log(`\n🔧 Planned Enhancements:`);
        execution.aiEnhancements.forEach((enhancement: any, index: number) => {
          console.log(`   ${index + 1}. ${enhancement.description} [${enhancement.type}]`);
        });
      }

    } catch (error) {
      console.error('❌ Error executing AI-enhanced attack chain:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:training')
  .description('Execute multiple attack chain variations for training')
  .argument('<name>', 'Attack chain name or ID')
  .option('--variations <count>', 'Number of variations to execute', '5')
  .option('--progressive', 'Use progressive difficulty (basic to advanced)', true)
  .option('--delay <ms>', 'Delay between variations in milliseconds', '30000')
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .action(async (name, options) => {
    try {
      console.log('🎓 Starting AI-Enhanced Training Session\n');
      
      const enhancedManager = new EnhancedAttackChainManager();
      const variationCount = parseInt(options.variations);
      const delayBetweenVariations = parseInt(options.delay);

      console.log(`📋 Training Configuration:`);
      console.log(`   Chain: ${name}`);
      console.log(`   Variations: ${variationCount}`);
      console.log(`   Progressive Mode: ${options.progressive}`);
      console.log(`   Delay Between Variations: ${delayBetweenVariations}ms`);
      console.log();

      const executions = await enhancedManager.executeTrainingSession(name, {
        variationCount,
        progressiveMode: options.progressive,
        delayBetweenVariations,
        logGeneratorConfig: options.config
      });

      console.log('✅ Training Session Completed\n');
      console.log(`📊 Training Results:`);
      console.log(`   Total Variations Executed: ${executions.length}`);
      const simulated = executions.every(exec => exec.executionMode === 'simulation');
      console.log(`   Total Logs ${simulated ? 'Written: 0 (simulation writes no logs)' : `Generated: ${executions.reduce((sum, exec) => sum + exec.stats.logsGenerated, 0)}`}`);
      if (simulated && executions.length > 0) {
        console.log(`   A full run of this chain writes ~${executions[0].stats.estimatedLogs} logs (npm run attack-chains:execute ${name})`);
      }
      console.log();

      console.log(`📈 Variation Breakdown:`);
      executions.forEach((execution, index) => {
        const changes = (execution.aiEnhancements || []).map((change: { type: string }) => change.type).join(', ');
        console.log(`   Variation ${index + 1}: ${execution.enhancementConfig.mode}/${execution.enhancementConfig.aiLevel} - ${simulated ? `planned: ${changes}` : `${execution.stats.logsGenerated} logs`}`);
      });

    } catch (error) {
      console.error('❌ Error executing training session:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:preview')
  .description('Preview attack chain enhancement without execution')
  .argument('<name>', 'Attack chain name or ID')
  .option('--mode <mode>', 'Enhancement mode: static, enhanced, dynamic', 'enhanced')
  .option('--ai-level <level>', 'AI level: basic, medium, high, advanced', 'medium')
  .action(async (name, options) => {
    try {
      console.log('👁️ Attack Chain Enhancement Preview\n');
      
      const enhancedManager = new EnhancedAttackChainManager();
      
      const preview = await enhancedManager.previewEnhancement(name, options.mode, options.aiLevel);

      console.log(`📋 Chain: ${preview.chain.name} (${preview.chain.id})`);
      console.log(`   Category: ${preview.chain.category}`);
      console.log(`   Difficulty: ${preview.chain.difficulty}`);
      console.log(`   Steps: ${preview.chain.stepCount}`);
      console.log(`   Techniques: ${preview.techniques.join(', ')}`);
      console.log();

      console.log(`🤖 Enhancement: mode ${preview.mode}, AI level ${preview.aiLevel}`);
      console.log(`📝 Planned Changes:`);
      preview.plannedChanges.forEach(change => {
        console.log(`   • ${change.description} [${change.type}]`);
      });
      console.log();

      console.log(`⏱️ Estimates at 1x speed (from the chain template):`);
      console.log(`   Duration: ~${Math.round(preview.estimatedDurationMs / 60000)} minutes`);
      console.log(`   Logs: ~${preview.estimatedLogs} log entries`);

    } catch (error) {
      console.error('❌ Error previewing enhancement:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:ai-options')
  .description('Show available AI enhancement options for a chain')
  .argument('<name>', 'Attack chain name or ID')
  .action(async (name) => {
    try {
      console.log('🤖 AI Enhancement Options\n');
      
      const enhancedManager = new EnhancedAttackChainManager();
      const options = enhancedManager.getEnhancementOptions(name);

      console.log(`📋 Chain: ${options.template.name}`);
      console.log(`   Category: ${options.template.category}`);
      console.log(`   Difficulty: ${options.template.difficulty}`);
      console.log();

      console.log(`🎛️ Available Enhancement Modes:`);
      options.availableModes.forEach((mode: any) => {
        console.log(`   ${mode.mode.toUpperCase()}:`);
        console.log(`     Description: ${mode.description}`);
        console.log(`     Requirements: ${mode.requirements.join(', ')}`);
        console.log();
      });

      console.log(`🎯 Available AI Levels:`);
      options.availableLevels.forEach((level: any) => {
        console.log(`   ${level.level.toUpperCase()}:`);
        console.log(`     Description: ${level.description}`);
        console.log(`     Features: ${level.features.join(', ')}`);
        console.log();
      });

      console.log(`💡 Recommendations:`);
      console.log(`   Beginner: --mode ${options.recommendations.beginnerMode} --ai-level ${options.recommendations.beginnerLevel}`);
      console.log(`   Expert: --mode ${options.recommendations.expertMode} --ai-level ${options.recommendations.expertLevel}`);

    } catch (error) {
      console.error('❌ Error showing AI options:', error);
      process.exit(1);
    }
  });

program
  .command('attack-chains:ai-statistics')
  .description('Show AI enhancement execution statistics')
  .option('--limit <count>', 'Number of recent executions to analyze', '50')
  .action(async (options) => {
    try {
      console.log('📊 AI Enhancement Statistics\n');
      
      const enhancedManager = new EnhancedAttackChainManager();
      const history = enhancedManager.getExecutionHistory(parseInt(options.limit));

      const { totalExecutions, modeDistribution, levelDistribution } = history.statistics;
      if (totalExecutions === 0) {
        console.log('No AI-enhanced executions recorded yet.');
        console.log('   Execution history is kept in memory for the current process only and is not saved between runs.');
        return;
      }

      const percent = (count: number): string => ((count / totalExecutions) * 100).toFixed(1);

      console.log(`📈 Execution Summary:`);
      console.log(`   Total Executions: ${totalExecutions}`);
      console.log();

      console.log(`🎛️ Mode Distribution:`);
      Object.entries(modeDistribution).forEach(([mode, count]) => {
        console.log(`   ${mode.toUpperCase()}: ${count} (${percent(count)}%)`);
      });
      console.log();

      console.log(`🎯 AI Level Distribution:`);
      Object.entries(levelDistribution).forEach(([level, count]) => {
        console.log(`   ${level.toUpperCase()}: ${count} (${percent(count)}%)`);
      });
      console.log();

      console.log(`🕒 Recent Executions:`);
      history.executions.forEach(execution => {
        console.log(`   ${execution.startTime.toISOString()}  ${execution.chainName}  ${execution.mode}/${execution.aiLevel}  ${execution.status} (${execution.executionMode})`);
      });

    } catch (error) {
      console.error('❌ Error showing AI statistics:', error);
      process.exit(1);
    }
  });

// ML Pattern Commands
// SOC Simulation Commands
program
  .command('soc-simulation')
  .description('Manage Security Operations Center (SOC) simulations')
  .action(() => {
    console.log('🛡️ SOC Simulation Management');
    console.log('Available subcommands:');
    console.log('  scenarios          - List available SOC simulation scenarios');
    console.log('  run <scenario>     - Run a specific SOC simulation scenario');
    console.log('  status             - Show status of running SOC simulations');
    console.log('  stop               - Stop all running SOC simulations');
    console.log('  d3fend-coverage    - Show D3FEND defensive technique coverage');
    console.log('\nExample: npm run soc-simulation:run incident-response');
  });

program
  .command('soc-simulation:scenarios')
  .description('List available SOC simulation scenarios')
  .action(async () => {
    try {
      console.log('🛡️ Available SOC Simulation Scenarios:\n');
      
      const scenarios = [
        {
          name: 'incident-response',
          description: 'Simulate SOC incident response workflow',
          duration: '15-30 minutes',
          techniques: ['D3-IAM', 'D3-NTA', 'D3-FA', 'D3-LAM']
        },
        {
          name: 'threat-hunting',
          description: 'Simulate proactive threat hunting activities',
          duration: '20-45 minutes',
          techniques: ['D3-NTA', 'D3-BHA', 'D3-PSA', 'D3-SCA']
        },
        {
          name: 'network-defense',
          description: 'Simulate network security monitoring and defense',
          duration: '10-25 minutes',
          techniques: ['D3-NTA', 'D3-ITF', 'D3-NI', 'D3-AC']
        },
        {
          name: 'malware-analysis',
          description: 'Simulate malware detection and analysis workflow',
          duration: '25-40 minutes',
          techniques: ['D3-FA', 'D3-DA', 'D3-SYMON', 'D3-PSA']
        },
        {
          name: 'compliance-audit',
          description: 'Simulate security compliance monitoring',
          duration: '15-30 minutes',
          techniques: ['D3-LAM', 'D3-AC', 'D3-SYMON']
        }
      ];

      scenarios.forEach((scenario, index) => {
        console.log(`${index + 1}. ${scenario.name}`);
        console.log(`   Description: ${scenario.description}`);
        console.log(`   Duration: ${scenario.duration}`);
        console.log(`   D3FEND Techniques: ${scenario.techniques.join(', ')}`);
        console.log();
      });

      console.log('💡 Usage: npm run soc-simulation:run <scenario-name>');
    } catch (error) {
      console.error('❌ Error listing SOC scenarios:', error);
      process.exit(1);
    }
  });

program
  .command('soc-simulation:run')
  .description('Run a specific SOC simulation scenario')
  .argument('<scenario>', 'SOC scenario name (e.g., incident-response, threat-hunting)')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-d, --duration <time>', 'Duration to run simulation (e.g., 30m, 1h)')
  .option('--analysts <count>', 'Number of SOC analysts to simulate', '3')
  .option('--intensity <level>', 'Simulation intensity (low, medium, high)', 'medium')
  .action(async (scenario, options) => {
    try {
      const validScenarios = ['incident-response', 'threat-hunting', 'network-defense', 'malware-analysis', 'compliance-audit'];
      
      if (!validScenarios.includes(scenario)) {
        console.error(`❌ Invalid scenario: ${scenario}`);
        console.error(`Valid scenarios: ${validScenarios.join(', ')}`);
        process.exit(1);
      }

      // Parse duration if provided
      let durationMs: number | undefined;
      if (options.duration) {
        const parsed = parseDuration(options.duration);
        if (!parsed) {
          console.error(`Invalid duration format: ${options.duration}`);
          process.exit(1);
        }
        durationMs = parsed;
      }

      console.log(`🛡️ Starting SOC Simulation: ${scenario}`);
      console.log(`   Analysts: ${options.analysts}`);
      console.log(`   Intensity: ${options.intensity}`);
      if (durationMs) {
        console.log(`   Duration: ${options.duration}`);
      }
      console.log();

      // Create a specialized configuration for SOC simulation
      const logGenerator = new LogGeneratorManager(options.config);
      
      // Start SOC simulation
      await logGenerator.start();
      
      if (durationMs) {
        setTimeout(() => {
          logGenerator.stop();
          console.log('🛡️ SOC simulation completed');
          process.exit(0);
        }, durationMs);
      }

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping SOC simulation...');
        logGenerator.stop();
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ Error running SOC simulation:', error);
      process.exit(1);
    }
  });

program
  .command('soc-simulation:d3fend-coverage')
  .description('Show D3FEND defensive technique coverage')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const { d3fendMapper } = await import('./utils/d3fendMapper');
      const coverage = d3fendMapper.getCoverageReport();

      if (options.json) {
        console.log(JSON.stringify(coverage, null, 2));
        return;
      }

      console.log('🛡️ D3FEND Defensive Technique Coverage:\n');
      
      console.log('📊 Coverage by Category:');
      Object.entries(coverage.byCategory).forEach(([category, techniques]) => {
        console.log(`   ${category}: ${techniques.length} techniques`);
      });
      console.log();

      console.log('🔧 Available Techniques:');
      coverage.techniques.forEach(technique => {
        console.log(`   ${technique.technique} - ${technique.description}`);
        console.log(`     Category: ${technique.category} | Effectiveness: ${technique.effectiveness || 'N/A'}`);
      });
      console.log();

      console.log(`📈 Total Coverage: ${coverage.techniques.length} D3FEND techniques`);
      console.log(`🤖 Automated: ${coverage.techniques.filter(t => t.automated).length} techniques`);
      
    } catch (error) {
      console.error('❌ Error getting D3FEND coverage:', error);
      process.exit(1);
    }
  });

program
  .command('d3fend-list')
  .description('List supported D3FEND defensive techniques')
  .option('--category <category>', 'Only one category (Detect, Deny, Disrupt, Degrade, Deceive, Contain)')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    try {
      const techniques = listD3fendTechniques(options.category);

      if (options.json) {
        console.log(JSON.stringify(techniques, null, 2));
        return;
      }

      console.log('🛡️ Supported D3FEND Defensive Techniques\n');
      const categories = [...new Set(techniques.map(t => t.category))];
      for (const category of categories) {
        const inCategory = techniques.filter(t => t.category === category);
        console.log(`📂 ${category} (${inCategory.length})`);
        for (const technique of inCategory) {
          const flags = [technique.effectiveness, technique.automated ? 'automated' : undefined].filter(Boolean).join(', ');
          console.log(`   ${technique.technique.padEnd(8)} ${technique.subcategory}${flags ? ` [${flags}]` : ''}`);
          console.log(`            ${technique.description}`);
        }
        console.log();
      }
      console.log(`Total: ${techniques.length} techniques`);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('d3fend-coverage')
  .description('Show which D3FEND defensive techniques appear in log files')
  .argument('[paths...]', 'Log files and/or directories of .jsonl/.json files (default: logs/historical)')
  .option('-f, --file <filename>', 'A file inside logs/historical')
  .option('--json', 'Output in JSON format')
  .action(async (inputPaths: string[], options) => {
    try {
      const targets = inputPaths.length > 0
        ? inputPaths
        : [options.file ? path.join('./logs/historical', options.file) : './logs/historical'];

      let loaded;
      try {
        loaded = await readLogFiles(targets);
      } catch (error) {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      const { files, logs, skipped } = loaded;

      const report = analyzeD3fendCoverage(logs);

      if (options.json) {
        console.log(JSON.stringify({ files, skippedLines: skipped, ...report }, null, 2));
        return;
      }

      console.log('\n🛡️ D3FEND Coverage Analysis\n');
      console.log(`📁 Files analyzed: ${files.length}${skipped > 0 ? ` (${skipped} non-log lines skipped)` : ''}`);
      if (report.totalLogs === 0) {
        console.log('⚠️  No logs found to analyze');
        return;
      }

      const percent = ((report.logsWithDefense / report.totalLogs) * 100).toFixed(1);
      console.log(`   Total logs analyzed: ${report.totalLogs}`);
      console.log(`   Logs with a D3FEND technique: ${report.logsWithDefense} (${percent}%)`);
      console.log(`   Techniques found: ${report.techniques.length} of ${report.techniques.length + report.unseenTechniques.length}\n`);

      if (report.techniques.length > 0) {
        console.log('🎯 Techniques Found:');
        for (const technique of report.techniques) {
          console.log(`   ${technique.technique.padEnd(8)} ${String(technique.count).padStart(6)} logs  ${technique.subcategory} (${technique.category})`);
        }
        console.log();

        console.log('📂 By Category:');
        for (const [category, count] of Object.entries(report.categories).sort(([, a], [, b]) => b - a)) {
          console.log(`   ${category}: ${count} logs`);
        }
        console.log();
      }

      if (report.unseenTechniques.length > 0) {
        console.log(`🕳️ Not seen in these logs: ${report.unseenTechniques.join(', ')}`);
      }
    } catch (error) {
      console.error('❌ Error analyzing D3FEND coverage:', error);
      process.exit(1);
    }
  });

program
  .command('ml-patterns')
  .description('Manage ML-based log pattern learning and generation')
  .action(() => {
    console.log('🧠 ML Pattern Management');
    console.log('Available subcommands:');
    console.log('  learn [paths...]        - Learn a profile (sources, levels, hourly volume, message patterns)');
    console.log('  status                  - Show the learned profile');
    console.log('  generate <source>       - Generate logs for a source from the learned profile');
    console.log('  analyze [paths...]      - Report patterns, levels, sources, anomalies and indicators');
    console.log('  config                  - Show or change the saved settings');
    console.log('  reset                   - Delete the learned profile and trained classifiers');
    console.log('  train-nlp [paths...]    - Train a text classifier (level, source or technique)');
    console.log('  test-anomaly [paths...] - Unusual volume windows, rare values and unusual logs');
    console.log('  forecast [paths...]     - Forecast log volume (trend or daily/weekly cycle)');
    console.log('  threat-intel [paths...] - Extract IPs, domains, emails and hashes; match a list');
    console.log('\nExample: npm run ml-patterns:learn logs/historical/ && npm run ml-patterns:generate auth-service -- --count 20');
  });

program
  .command('ml-patterns:learn')
  .description('Learn a profile (sources, levels, hourly volume, message patterns) from log files')
  .argument('[paths...]', 'Log files and/or directories (default: logs/historical)')
  .option('--min-samples <number>', 'Minimum logs needed (default from ml-patterns:config, 1000)')
  .option('--max-history-days <number>', 'Only use logs within this many days of the newest log (default from ml-patterns:config, 30)')
  .option('--output-dir <path>', 'Save the profile as <path>/profile.json instead of the configured profilePath')
  .option('--json', 'Output in JSON format')
  .action(async (paths: string[], options) => {
    try {
      let settings = await loadSettings();
      if (options.minSamples !== undefined) settings = setSetting(settings, 'minSamples', options.minSamples);
      if (options.maxHistoryDays !== undefined) settings = setSetting(settings, 'maxHistoryDays', options.maxHistoryDays);
      const { files, logs } = await loadLogsForAnalysis(paths);

      const profile = buildProfile(logs, { files, maxHistoryDays: settings.maxHistoryDays, maxTemplatesPerSource: settings.maxTemplatesPerSource });
      if (profile.totalLogs < settings.minSamples) {
        console.error(`❌ Need at least ${settings.minSamples} logs to learn (found ${profile.totalLogs} within ${settings.maxHistoryDays} days of the newest log).`);
        console.error('   Lower the minimum with --min-samples, or permanently with: npm run ml-patterns:config -- --set minSamples=<n>');
        process.exit(1);
      }
      const profilePath = options.outputDir ? path.join(options.outputDir, 'profile.json') : settings.profilePath;
      await saveProfile(profile, profilePath);

      if (options.json) {
        console.log(JSON.stringify({ profilePath, ...profile }, null, 2));
        return;
      }

      console.log('\n🧠 Learned Profile\n');
      console.log(`   Files: ${files.length}  |  Logs used: ${profile.totalLogs}${profile.totalLogs < logs.length ? ` (of ${logs.length}; older than ${settings.maxHistoryDays} days skipped)` : ''}`);
      if (profile.timeRange) console.log(`   Time range: ${profile.timeRange.start} → ${profile.timeRange.end}`);
      console.log('\n   Source                    Logs   Share  Patterns  Main level');
      for (const [name, source] of Object.entries(profile.sources).sort(([, a], [, b]) => b.count - a.count)) {
        const mainLevel = Object.entries(source.levels).sort(([, a], [, b]) => b - a)[0]?.[0] || '-';
        console.log(`   ${name.padEnd(24)} ${String(source.count).padStart(6)}  ${(source.share * 100).toFixed(1).padStart(5)}%  ${String(source.templates.length).padStart(8)}  ${mainLevel}`);
      }
      console.log(`\n   Saved to: ${profilePath}`);
      console.log('   Next: npm run ml-patterns:generate <source> -- --count 20');
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:status')
  .description('Show the learned profile')
  .option('--json', 'Output in JSON format')
  .option('--detailed', 'List the top message patterns per source')
  .action(async (options) => {
    try {
      const settings = await loadSettings();
      if (!(await fs.pathExists(settings.profilePath))) {
        if (options.json) {
          console.log(JSON.stringify({ learned: false, profilePath: settings.profilePath }, null, 2));
        } else {
          console.log(`🧠 No learned profile yet (${settings.profilePath}).`);
          console.log('   Create one with: npm run ml-patterns:learn logs/historical/');
        }
        return;
      }
      const profile = await loadProfile(settings.profilePath);

      if (options.json) {
        console.log(JSON.stringify({ learned: true, profilePath: settings.profilePath, ...profile }, null, 2));
        return;
      }

      const patternCount = Object.values(profile.sources).reduce((sum, source) => sum + source.templates.length, 0);
      console.log('\n🧠 Learned Profile\n');
      console.log(`   File: ${settings.profilePath}`);
      console.log(`   Learned: ${profile.learnedAt}  |  Logs: ${profile.totalLogs}  |  Sources: ${Object.keys(profile.sources).length}  |  Patterns: ${patternCount}`);
      if (profile.timeRange) console.log(`   Time range: ${profile.timeRange.start} → ${profile.timeRange.end}`);
      for (const [name, source] of Object.entries(profile.sources).sort(([, a], [, b]) => b.count - a.count)) {
        console.log(`\n   ${name} (${source.type}): ${source.count} logs, levels ${Object.entries(source.levels).map(([level, count]) => `${level} ${count}`).join(', ')}`);
        if (options.detailed) {
          for (const template of source.templates.slice(0, 5)) {
            console.log(`      ${(template.share * 100).toFixed(1).padStart(5)}%  ${template.template.slice(0, 100)}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:generate')
  .description('Generate logs for a source from the learned profile')
  .argument('<source>', 'A learned source name or type (see ml-patterns:status)')
  .option('--count <number>', 'Number of logs to generate', '10')
  .option('--anomaly-rate <number>', 'Share of logs drawn from rare patterns/levels, 0-1 (default from ml-patterns:config, 0.05)')
  .option('--user-id <string>', 'Set metadata.userId on every log')
  .option('--system-id <string>', 'Set metadata.systemId on every log')
  .option('--seed <number>', 'Seed for reproducible output')
  .option('--output <file>', 'Write to a file instead of stdout')
  .option('--format <format>', 'Output format: json, syslog, cef or wazuh', 'json')
  .action(async (sourceName: string, options) => {
    try {
      const settings = await loadSettings();
      if (!(await fs.pathExists(settings.profilePath))) {
        console.error(`❌ No learned profile at ${settings.profilePath}. Create one with: npm run ml-patterns:learn logs/historical/`);
        process.exit(1);
      }
      const count = Number(options.count);
      if (!Number.isInteger(count) || count < 1) {
        console.error(`❌ Invalid --count "${options.count}". Use a whole number of at least 1`);
        process.exit(1);
      }
      const anomalyRate = options.anomalyRate !== undefined ? setSetting(settings, 'anomalyRate', options.anomalyRate).anomalyRate : settings.anomalyRate;
      const formatters: Record<string, (entry: LogEntry) => string> = {
        json: entry => LogFormatters.formatAsJSON(entry),
        syslog: entry => LogFormatters.formatAsSyslog(entry),
        cef: entry => LogFormatters.formatAsCEF(entry),
        wazuh: entry => LogFormatters.formatForWazuh(entry)
      };
      if (!formatters[options.format]) {
        console.error(`❌ Invalid --format "${options.format}". Use json, syslog, cef or wazuh`);
        process.exit(1);
      }

      const profile = await loadProfile(settings.profilePath);
      const logs = generateFromProfile(profile, sourceName, {
        count,
        anomalyRate,
        seed: options.seed !== undefined ? Number(options.seed) : undefined,
        userId: options.userId,
        systemId: options.systemId
      });
      const output = logs.map(formatters[options.format]).join('\n') + '\n';

      if (options.output) {
        await fs.ensureDir(path.dirname(options.output));
        await fs.writeFile(options.output, output);
        const anomalies = logs.filter(log => log.metadata.is_anomaly).length;
        console.log(`✅ Wrote ${logs.length} ${options.format} logs for ${logs[0].source.name} to ${options.output} (${anomalies} anomalous)`);
      } else {
        process.stdout.write(output);
      }
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:analyze')
  .description('Report message patterns, levels, sources, busy hours, anomalies and indicators in log files')
  .argument('[paths...]', 'Log files and/or directories (default: logs/historical)')
  .option('--focus <type>', 'Only analyze user, system, security or application logs')
  .option('--top <number>', 'How many message patterns to list', '10')
  .option('--output <file>', 'Also save the report as JSON to this file')
  .option('--json', 'Output in JSON format')
  .action(async (paths: string[], options) => {
    try {
      const top = Math.round(parsePositiveNumber(options.top, '--top'));
      const { files, logs } = await loadLogsForAnalysis(paths);
      const report = analyzeLogs(logs, { focus: options.focus, top });

      if (options.output) {
        await fs.ensureDir(path.dirname(options.output));
        await fs.writeFile(options.output, JSON.stringify({ files, ...report }, null, 2));
      }
      if (options.json) {
        console.log(JSON.stringify({ files, ...report }, null, 2));
        return;
      }

      console.log('\n🔍 Log Analysis\n');
      console.log(`   Files: ${files.length}  |  Logs analyzed: ${report.analyzedLogs}${report.focus ? ` of ${report.totalLogs} (focus: ${report.focus})` : ''}`);
      console.log(`   Levels: ${Object.entries(report.levels).map(([level, count]) => `${level} ${count}`).join(', ') || 'none'}`);
      console.log(`   Sources: ${Object.entries(report.sources).sort(([, a], [, b]) => b - a).map(([name, count]) => `${name} ${count}`).join(', ') || 'none'}`);
      if (report.busiestHours.length > 0) {
        console.log(`   Busiest hours (UTC): ${report.busiestHours.map(h => `${String(h.hour).padStart(2, '0')}:00 (${(h.share * 100).toFixed(1)}%)`).join(', ')}`);
      }
      console.log(`\n📋 Top message patterns:`);
      for (const template of report.templates) {
        console.log(`   ${String(template.count).padStart(6)}  ${(template.share * 100).toFixed(1).padStart(5)}%  ${template.template.slice(0, 100)}`);
      }
      console.log(`\n📈 Minute windows with unusual volume: ${report.volumeAnomalies.length}`);
      for (const anomaly of report.volumeAnomalies.slice(0, 5)) {
        console.log(`   ${new Date(anomaly.start).toISOString()}  ${anomaly.count} logs (${anomaly.direction})`);
      }
      if (report.outliers.length > 0) {
        console.log('\n🧪 Most unusual logs:');
        for (const outlier of report.outliers) {
          console.log(`   ${outlier.score.toFixed(2)}  ${outlier.message.slice(0, 100)}`);
        }
      }
      console.log(`\n🕵️ Indicators: ${Object.entries(report.indicators).map(([type, count]) => `${type} ${count}`).join(', ') || 'none'}`);
      if (options.output) console.log(`\n   Report saved to ${options.output}`);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:config')
  .description('Show or change the saved ml-patterns settings')
  .option('--show', 'Show the current settings (the default)')
  .option('--set <key=value>', 'Change a setting; repeat for several', (value: string, previous: string[]) => [...previous, value], [] as string[])
  .option('--reset', 'Restore the default settings')
  .option('--file <path>', 'Apply settings from a JSON file')
  .action(async (options) => {
    try {
      let settings = options.reset ? { ...DEFAULT_SETTINGS } : await loadSettings();
      if (options.file) settings = await mergeSettingsFile(settings, options.file);
      for (const assignment of options.set as string[]) {
        const separator = assignment.indexOf('=');
        if (separator < 1) throw new Error(`Invalid --set "${assignment}". Use key=value`);
        settings = setSetting(settings, assignment.slice(0, separator).trim(), assignment.slice(separator + 1).trim());
      }
      const changed = Boolean(options.reset || options.file || (options.set as string[]).length > 0);
      if (changed) await saveSettings(settings);

      console.log(`⚙️  ml-patterns settings (${DEFAULT_SETTINGS_PATH})${changed ? ' - saved' : ''}\n`);
      for (const [key, value] of Object.entries(settings)) {
        const isDefault = value === DEFAULT_SETTINGS[key as keyof MlSettings];
        console.log(`   ${key.padEnd(22)} ${String(value)}${isDefault ? '' : '   (default: ' + String(DEFAULT_SETTINGS[key as keyof MlSettings]) + ')'}`);
      }
      if (!changed) console.log('\n   Change one with: npm run ml-patterns:config -- --set anomalyRate=0.1');
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:reset')
  .description('Delete the learned profile and trained text classifiers')
  .option('--confirm', 'Delete without asking again')
  .action(async (options) => {
    try {
      const settings = await loadSettings();
      const modelsDir = path.dirname(settings.profilePath);
      const classifiers = (await fs.pathExists(modelsDir))
        ? (await fs.readdir(modelsDir)).filter(name => /^nlp-.*-classifier\.json$/.test(name)).map(name => path.join(modelsDir, name))
        : [];
      const targets = [...((await fs.pathExists(settings.profilePath)) ? [settings.profilePath] : []), ...classifiers];

      if (targets.length === 0) {
        console.log('🧠 Nothing to reset: no learned profile or trained classifiers found.');
        return;
      }
      if (!options.confirm) {
        console.log('⚠️  This would delete:');
        targets.forEach(target => console.log(`   ${target}`));
        console.log('\n   To confirm: npm run ml-patterns:reset -- --confirm');
        return;
      }
      for (const target of targets) await fs.remove(target);
      console.log(`✅ Deleted ${targets.length} file(s):`);
      targets.forEach(target => console.log(`   ${target}`));
      console.log('   Settings are kept; restore them with: npm run ml-patterns:config -- --reset');
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

function parseDuration(duration: string): number | null {
  if (!duration) return null;
  
  // Remove spaces and convert to lowercase
  const normalized = duration.replace(/\s+/g, '').toLowerCase();
  
  // Parse formats like: 30m, 1h, 2h30m, 90s, 1h30m45s
  const regex = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = normalized.match(regex);
  
  if (!match) return null;
  
  const [, hours, minutes, seconds] = match;
  
  let totalMs = 0;
  if (hours) totalMs += parseInt(hours) * 60 * 60 * 1000;
  if (minutes) totalMs += parseInt(minutes) * 60 * 1000;
  if (seconds) totalMs += parseInt(seconds) * 1000;
  
  return totalMs > 0 ? totalMs : null;
}

/** Read logs for the analysis commands, or print the error and exit */
async function loadLogsForAnalysis(paths: string[]): Promise<LogFilesResult> {
  try {
    const result = await readLogFiles(paths.length > 0 ? paths : ['./logs/historical']);
    if (result.logs.length === 0) {
      console.error('❌ No logs found in the given files');
      process.exit(1);
    }
    return result;
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function parsePositiveNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!(parsed > 0)) {
    console.error(`❌ Invalid ${name} "${value}". Use a number greater than 0`);
    process.exit(1);
  }
  return parsed;
}

function parseWindow(value: string): number {
  const windowMs = parseDuration(value);
  if (!windowMs) {
    console.error(`❌ Invalid --window "${value}". Use formats like 30s, 1m or 1h`);
    process.exit(1);
  }
  return windowMs;
}

program
  .command('ml-patterns:train-nlp')
  .description('Train a text classifier on log messages and report held-out accuracy')
  .argument('[paths...]', 'Log files and/or directories (default: logs/historical)')
  .option('--label <field>', 'Field to predict: level, source or technique', 'level')
  .option('--output <file>', 'Where to save the model (default: models/ml-patterns/nlp-<label>-classifier.json)')
  .option('--classify <text>', 'Classify this text with the trained model')
  .option('--json', 'Output in JSON format')
  .action(async (paths: string[], options) => {
    if (!['level', 'source', 'technique'].includes(options.label)) {
      console.error(`❌ Invalid --label "${options.label}". Use level, source or technique`);
      process.exit(1);
    }
    const { files, logs } = await loadLogsForAnalysis(paths);

    try {
      const result = trainTextClassifier(logs, options.label as ClassifierLabel);
      const output = options.output || path.join('models', 'ml-patterns', `nlp-${result.label}-classifier.json`);
      await fs.ensureDir(path.dirname(output));
      await fs.writeFile(output, result.model);
      const prediction = options.classify ? loadTextClassifier(result.model).classify(options.classify) : undefined;

      if (options.json) {
        const { model, ...summary } = result;
        console.log(JSON.stringify({ files, modelFile: output, ...summary, ...(prediction !== undefined ? { prediction } : {}) }, null, 2));
        return;
      }

      console.log('\n🧠 Text Classifier Training\n');
      console.log(`   Files: ${files.length}  |  Label: ${result.label}`);
      console.log(`   Trained on ${result.trainSize} logs, tested on ${result.testSize} held-out logs`);
      console.log(`   Accuracy: ${(result.accuracy * 100).toFixed(1)}%  (always guessing the most common ${result.label}: ${(result.baselineAccuracy * 100).toFixed(1)}%)`);
      console.log(`   Classes: ${result.labels.map(l => `${l.label} (${l.count})`).join(', ')}`);
      if (result.excludedLabels.length > 0) {
        console.log(`   Left out (fewer than 5 examples): ${result.excludedLabels.map(l => `${l.label} (${l.count})`).join(', ')}`);
      }
      console.log(`   Model saved to: ${output}`);
      if (prediction !== undefined) {
        console.log(`\n   "${options.classify}" → ${prediction}`);
      }
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:test-anomaly')
  .description('Find unusual log volume per time window and rare levels/sources')
  .argument('[paths...]', 'Log files and/or directories (default: logs/historical)')
  .option('--window <time>', 'Time window size, e.g. 30s, 1m, 1h', '1m')
  .option('--threshold <number>', 'Flag windows more than this many standard deviations from the mean', '3')
  .option('--rare-share <number>', 'List levels/sources seen in less than this share of logs', '0.01')
  .option('--outliers <number>', 'How many of the most unusual individual logs to list (0 to skip)', '10')
  .option('--json', 'Output in JSON format')
  .action(async (paths: string[], options) => {
    const windowMs = parseWindow(options.window);
    const threshold = parsePositiveNumber(options.threshold, '--threshold');
    const rareShare = parsePositiveNumber(options.rareShare, '--rare-share');
    const outlierCount = Number(options.outliers);
    if (!Number.isInteger(outlierCount) || outlierCount < 0) {
      console.error(`❌ Invalid --outliers "${options.outliers}". Use a whole number, 0 or more`);
      process.exit(1);
    }
    const { files, logs } = await loadLogsForAnalysis(paths);

    const buckets = bucketByWindow(logs, windowMs);
    const volume = detectVolumeAnomalies(buckets, threshold);
    const rareLevels = rareValues(logs, 'level', rareShare);
    const rareSources = rareValues(logs, 'source', rareShare);
    const logOutliers = outlierCount > 0 && logs.length >= 20 ? detectLogOutliers(logs, { top: outlierCount }).outliers : [];

    if (options.json) {
      console.log(JSON.stringify({ files, totalLogs: logs.length, windowMs, windows: buckets.length, emptyWindows: buckets.filter(bucket => bucket.count === 0).length, ...volume, rareLevels, rareSources, logOutliers }, null, 2));
      return;
    }

    console.log('\n🔎 Anomaly Check\n');
    const emptyWindows = buckets.filter(bucket => bucket.count === 0).length;
    console.log(`   Files: ${files.length}  |  Logs: ${logs.length}  |  Windows: ${buckets.length} × ${options.window}${emptyWindows > 0 ? ` (${emptyWindows} with no logs)` : ''}`);
    if (buckets.length === 0) {
      console.log('   ⚠️  No logs with valid timestamps; volume check skipped');
    } else {
      console.log(`   Logs per window: mean ${volume.mean.toFixed(1)}, standard deviation ${volume.stdDev.toFixed(1)}`);
      console.log(`\n📈 Unusual windows (beyond ${threshold} standard deviations): ${volume.anomalies.length}`);
      for (const anomaly of volume.anomalies.slice(0, 20)) {
        console.log(`   ${new Date(anomaly.start).toISOString()}  ${String(anomaly.count).padStart(6)} logs  ${anomaly.direction} (z=${anomaly.zScore.toFixed(1)})`);
      }
    }
    const printRare = (title: string, values: RareValue[]) => {
      console.log(`\n${title}: ${values.length}`);
      for (const value of values.slice(0, 20)) {
        console.log(`   ${value.value.padEnd(24)} ${String(value.count).padStart(6)} logs (${(value.share * 100).toFixed(2)}%)`);
      }
    };
    printRare(`🔸 Rare levels (under ${(rareShare * 100).toFixed(2)}% of logs)`, rareLevels);
    printRare(`🔸 Rare sources (under ${(rareShare * 100).toFixed(2)}% of logs)`, rareSources);

    if (outlierCount > 0) {
      if (logs.length < 20) {
        console.log('\n🧪 Unusual individual logs: skipped (needs at least 20 logs)');
      } else {
        console.log(`\n🧪 Most unusual individual logs (isolation forest; score near 1 = most unusual):`);
        for (const outlier of logOutliers) {
          const why = outlier.reasons.map(r => `${r.feature} ${Number(r.value.toFixed(2))} vs typical ${Number(r.typical.toFixed(2))}`).join('; ');
          console.log(`   ${outlier.score.toFixed(2)}  [${outlier.level || '-'}] ${outlier.source || '-'}: ${outlier.message.slice(0, 90)}`);
          if (why) console.log(`         ${why}`);
        }
      }
    }
  });

program
  .command('ml-patterns:forecast')
  .description('Forecast log volume per time window from a linear trend')
  .argument('[paths...]', 'Log files and/or directories (default: logs/historical)')
  .option('--window <time>', 'Time window size, e.g. 30s, 1m, 1h', '1m')
  .option('--horizon <number>', 'How many future windows to forecast', '10')
  .option('--seasonality <mode>', 'auto, none, daily or weekly (auto uses a daily/weekly cycle when history allows)', 'auto')
  .option('--json', 'Output in JSON format')
  .action(async (paths: string[], options) => {
    const windowMs = parseWindow(options.window);
    const horizon = Math.round(parsePositiveNumber(options.horizon, '--horizon'));
    if (!['auto', 'none', 'daily', 'weekly'].includes(options.seasonality)) {
      console.error(`❌ Invalid --seasonality "${options.seasonality}". Use auto, none, daily or weekly`);
      process.exit(1);
    }
    const { files, logs } = await loadLogsForAnalysis(paths);

    try {
      const buckets = bucketByWindow(logs, windowMs);
      let result: AutoForecast;
      if (options.seasonality === 'auto') {
        result = forecastAuto(buckets, horizon, windowMs);
      } else if (options.seasonality === 'none') {
        result = { ...forecastVolume(buckets, horizon, windowMs), method: 'linear' };
      } else {
        const period = options.seasonality === 'daily' ? 86400000 : 7 * 86400000;
        const seasonLength = period / windowMs;
        if (!Number.isInteger(seasonLength) || seasonLength < 2) {
          throw new Error(`--window ${options.window} does not divide a ${options.seasonality} cycle evenly`);
        }
        result = { ...forecastSeasonal(buckets, horizon, windowMs, seasonLength), method: 'holt-winters' };
      }
      const forecast = result.forecast;

      if (options.json) {
        console.log(JSON.stringify({ files, totalLogs: logs.length, windowMs, history: buckets.length, ...result }, null, 2));
        return;
      }

      console.log('\n📉 Volume Forecast\n');
      console.log(`   Files: ${files.length}  |  Logs: ${logs.length}  |  History: ${buckets.length} × ${options.window}`);
      const errorNote = result.alternativeError !== undefined
        ? ` (the ${result.method === 'linear' ? 'seasonal' : 'linear'} model's was ${result.alternativeError.toFixed(1)})`
        : '';
      if (result.method === 'holt-winters') {
        console.log(`   Method: seasonal (Holt-Winters), cycle of ${result.seasonLength} windows`);
        console.log(`   Mean error on history: ${result.meanAbsoluteError.toFixed(1)} logs per window${errorNote}`);
      } else {
        const why = options.seasonality === 'auto'
          ? (result.alternativeError === undefined ? ' (not enough history for a daily/weekly cycle)' : ' (fits the history better than a daily/weekly cycle)')
          : '';
        console.log(`   Method: linear trend${why}`);
        console.log(`   Trend: ${result.slopePerWindow >= 0 ? '+' : ''}${result.slopePerWindow.toFixed(2)} logs per window  |  Fit (R²): ${result.rSquared.toFixed(3)}`);
        console.log(`   Mean error on history: ${result.meanAbsoluteError.toFixed(1)} logs per window${errorNote}`);
        if (result.rSquared < 0.3) {
          console.log('   ⚠️  Low R²: volume does not follow a clear trend, so treat the forecast as rough');
        }
      }
      console.log('\n   Next windows:');
      for (const point of forecast) {
        console.log(`   ${new Date(point.start).toISOString()}  ~${point.count} logs`);
      }
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:threat-intel')
  .description('Extract IPs, domains and file hashes from logs and match them against an indicator list')
  .argument('[paths...]', 'Log files and/or directories (default: logs/historical)')
  .option('--iocs <file>', 'Indicator list to match against, one value per line (# comments allowed)')
  .option('--top <number>', 'How many of the most frequent indicators to show', '20')
  .option('--json', 'Output in JSON format')
  .action(async (paths: string[], options) => {
    const top = Math.round(parsePositiveNumber(options.top, '--top'));
    let list: Set<string> | undefined;
    if (options.iocs) {
      if (!(await fs.pathExists(options.iocs))) {
        console.error(`❌ Not found: ${options.iocs}`);
        process.exit(1);
      }
      list = parseIndicatorList(await fs.readFile(options.iocs, 'utf8'));
    }
    const { files, logs } = await loadLogsForAnalysis(paths);

    const indicators = extractIndicators(logs);
    const matches = list ? matchIndicators(indicators, list) : undefined;
    const byType = indicators.reduce<Record<string, number>>((counts, indicator) => ({
      ...counts, [indicator.type]: (counts[indicator.type] || 0) + 1
    }), {});

    if (options.json) {
      console.log(JSON.stringify({ files, totalLogs: logs.length, uniqueIndicators: indicators.length, byType, indicators: indicators.slice(0, top), ...(matches ? { listSize: list!.size, matches } : {}) }, null, 2));
      return;
    }

    console.log('\n🕵️ Indicator Extraction\n');
    console.log(`   Files: ${files.length}  |  Logs: ${logs.length}  |  Unique indicators: ${indicators.length}`);
    console.log(`   By type: ${Object.entries(byType).map(([type, count]) => `${type} ${count}`).join(', ') || 'none'}`);
    if (indicators.length > 0) {
      console.log(`\n   Most frequent (top ${Math.min(top, indicators.length)}):`);
      for (const indicator of indicators.slice(0, top)) {
        console.log(`   ${indicator.type.padEnd(7)} ${indicator.value.padEnd(40)} ${String(indicator.count).padStart(6)}${indicator.scope ? `  ${indicator.scope}` : ''}`);
      }
    }
    if (matches && list) {
      console.log(`\n🚩 Matches against ${options.iocs} (${list.size} entries): ${matches.length}`);
      for (const match of matches) {
        console.log(`   ${match.type.padEnd(7)} ${match.value.padEnd(40)} ${String(match.count).padStart(6)}`);
      }
    } else {
      console.log('\n   Tip: pass --iocs <file> to match these against your own indicator list');
    }
  });

program
  .command('performance-test')
  .description('Run comprehensive performance tests with worker threads')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--workers <count>', 'Number of worker threads to use', '4')
  .option('--duration <time>', 'Test duration (e.g., 10s, 2m)', '10s')
  .option('--mode <mode>', 'Test mode: disk, http, syslog, worker', 'worker')
  .action(async (options) => {
    try {
      console.log('🚀 Starting Performance Test...\n');
      
      const { LogGeneratorManager } = await import('./LogGeneratorManager');
      const workerCount = parseInt(options.workers);
      const duration = options.duration;
      
      // Parse duration
      const durationMatch = duration.match(/^(\d+)([smh])$/);
      if (!durationMatch) {
        console.error('❌ Invalid duration format. Use format like: 10s, 2m, 1h');
        process.exit(1);
      }
      
      const durationValue = parseInt(durationMatch[1]);
      const durationUnit = durationMatch[2];
      let durationMs: number;
      
      switch (durationUnit) {
        case 's': durationMs = durationValue * 1000; break;
        case 'm': durationMs = durationValue * 60 * 1000; break;
        case 'h': durationMs = durationValue * 60 * 60 * 1000; break;
        default: durationMs = 10000;
      }
      
      console.log(`🔧 Configuration:`);
      console.log(`   Mode: ${options.mode}`);
      console.log(`   Workers: ${workerCount}`);
      console.log(`   Duration: ${duration} (${durationMs}ms)`);
      console.log(`   Config: ${options.config || 'default'}\n`);
      
      // Select appropriate config based on mode
      let configPath = options.config;
      if (!configPath) {
        switch (options.mode) {
          case 'http':
            configPath = 'src/config/siem-http-test.yaml';
            break;
          case 'syslog':
            configPath = 'src/config/siem-syslog-test.yaml';
            break;
          case 'worker':
            configPath = 'src/config/high-performance-worker-test.yaml';
            break;
          default:
            configPath = 'src/config/extreme-performance.yaml';
        }
      }
      
      const logGenerator = new LogGeneratorManager(configPath);
      
      // Enable high-performance mode if using worker mode
      if (options.mode === 'worker') {
        logGenerator.enableHighPerformanceMode(workerCount);
        console.log(`⚡ High-performance mode enabled with ${workerCount} workers\n`);
      }
      
      const startTime = Date.now();
      console.log(`🏁 Starting performance test at ${new Date().toISOString()}`);
      
      // Start generation
      logGenerator.start();
      
      // Run for specified duration
      await new Promise(resolve => setTimeout(resolve, durationMs));
      
      // Stop generation
      logGenerator.stop();
      
      const endTime = Date.now();
      const actualDuration = (endTime - startTime) / 1000;
      
      console.log(`\n🏁 Performance test completed in ${actualDuration.toFixed(2)}s`);
      
      // Get performance stats
      const stats = logGenerator.getPerformanceStats();
      console.log('\n📊 Performance Statistics:');
      console.log(`   High-performance mode: ${stats.isHighPerformanceMode ? '✅' : '❌'}`);
      console.log(`   Worker threads active: ${stats.workerThreadsActive ? '✅' : '❌'}`);
      console.log(`   Active generators: ${stats.runningGenerators.length}`);
      console.log(`   Generator names: ${stats.runningGenerators.join(', ')}`);
      
      // Cleanup
      if (options.mode === 'worker') {
        await logGenerator.disableHighPerformanceMode();
      }
      
      console.log('\n✅ Performance test completed successfully!');
      
    } catch (error) {
      console.error('❌ Error running performance test:', error);
      process.exit(1);
    }
  });

program
  .command('benchmark')
  .description('Measure maximum throughput: every generator, format and output (local only), and worker-thread scaling')
  .option('-c, --config <path>', 'Configuration file whose generator templates are used')
  .option('-d, --duration <time>', 'Time per measurement (e.g. 500ms, 3s, 1m)', '3s')
  .option('--phases <list>', 'Phases to run: generators,formats,outputs,workers', 'generators,formats,outputs,workers')
  .option('--workers <list>', 'Worker thread counts to try, e.g. 1,2,4 (default: doubling up to the CPU count)')
  .option('--format <format>', 'Format the worker threads produce: json, syslog, cef, wazuh', 'json')
  .option('--json <file>', 'Also save the full report as JSON')
  .action(async (raw) => {
    try {
      const { parseBenchmarkOptions } = await import('./benchmark/options');
      const { runBenchmark } = await import('./benchmark/runBenchmark');
      const { renderReport } = await import('./benchmark/report');
      const options = parseBenchmarkOptions(raw);

      console.log(`⏱️  Benchmark: ${options.phases.join(', ')} (${options.durationMs / 1000}s per measurement)\n`);
      const report = await runBenchmark({ ...options, onProgress: message => console.log(`   … ${message}`) });
      console.log(`\n${renderReport(report)}`);

      if (raw.json) {
        await fs.outputFile(raw.json, JSON.stringify(report, null, 2));
        console.log(`\n💾 Report saved to ${raw.json}`);
      }
      process.exit(0);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program.parse();
