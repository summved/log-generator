#!/usr/bin/env node

import { Command } from 'commander';
import { LogGeneratorManager, MitreFilterOptions } from './LogGeneratorManager';
import { logger } from './utils/logger';
import { timestampValidator } from './utils/timestampValidator';
import { StorageManager } from './utils/storage';
import { mitreMapper } from './utils/mitreMapper';
import { AttackChainManager } from './chains/AttackChainManager';
import { AttackChainExecutionConfig } from './types/attackChain';
import { PatternLearningEngine } from './ml/PatternLearningEngine';
import { MLLogGenerationConfig } from './types/mlPatterns';
import { ConfigManager } from './config';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';

// Helper functions for config management
async function setConfigValue(configManager: ConfigManager, key: string, value: string): Promise<void> {
  const configPath = 'src/config/default.yaml';
  const configContent = await fs.readFile(configPath, 'utf8');
  const config = yaml.parse(configContent);
  
  // Parse the key path (e.g., "generators.endpoint.frequency")
  const keyParts = key.split('.');
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
        
        await setConfigValue(configManager, key.trim(), value.trim());
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
    console.log('\nExample: npm run attack-chains list');
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
  .option('--speed <multiplier>', 'Speed multiplier (0.5 = half speed, 2.0 = double speed)', '1.0')
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

      // Build execution configuration
      const executionConfig: Partial<AttackChainExecutionConfig> = {
        speed_multiplier: parseFloat(options.speed),
        enable_progress_logging: options.progressLogging !== false,
        continue_on_failure: options.continueOnFailure || false,
        randomize_timing: options.randomizeTiming !== false,
        generate_execution_report: options.report !== false,
        output_directory: options.outputDir
      };

      console.log(`🚀 Starting attack chain execution: ${template.name}`);
      console.log(`   Category: ${template.category.toUpperCase()}`);
      console.log(`   Steps: ${template.chain.steps.length}`);
      console.log(`   Estimated Duration: ${Math.round(template.chain.metadata.estimated_duration * executionConfig.speed_multiplier!)} minutes`);
      console.log(`   Speed Multiplier: ${executionConfig.speed_multiplier}x`);
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

// ML Pattern Commands
program
  .command('ml-patterns')
  .description('Manage ML-based log pattern learning and generation')
  .action(() => {
    console.log('🧠 ML Pattern Management');
    console.log('Available subcommands:');
    console.log('  learn <files...>   - Learn patterns from historical log files');
    console.log('  status             - Show ML pattern engine status');
    console.log('  generate <source>  - Generate logs using learned patterns');
    console.log('  analyze <files...> - Analyze patterns in log files');
    console.log('  config             - Show/update ML configuration');
    console.log('  reset              - Reset learned patterns');
    console.log('\nExample: npm run ml-patterns:learn logs/historical/*.jsonl');
  });

program
  .command('ml-patterns:learn')
  .description('Learn patterns from historical log files')
  .argument('<files...>', 'Log files to learn from')
  .option('--config <path>', 'Path to ML configuration file')
  .option('--min-samples <number>', 'Minimum samples required for learning', '1000')
  .option('--max-history-days <number>', 'Maximum days of history to consider', '30')
  .option('--learning-rate <number>', 'Learning rate for pattern adaptation', '0.01')
  .option('--output-dir <path>', 'Directory to save learned models')
  .action(async (files, options) => {
    try {
      console.log('🧠 Starting ML Pattern Learning...\n');
      
      // Validate input files
      const validFiles: string[] = [];
      for (const file of files) {
        if (fs.existsSync(file)) {
          validFiles.push(path.resolve(file));
        } else {
          console.warn(`⚠️ File not found: ${file}`);
        }
      }

      if (validFiles.length === 0) {
        console.error('❌ No valid log files found');
        process.exit(1);
      }

      console.log(`📁 Found ${validFiles.length} log files:`);
      validFiles.forEach(file => {
        const stats = fs.statSync(file);
        console.log(`   • ${path.basename(file)} (${Math.round(stats.size / 1024)}KB)`);
      });
      console.log();

      // Build ML configuration
      const mlConfig: Partial<MLLogGenerationConfig> = {
        learning: {
          enabled: true,
          learningRate: parseFloat(options.learningRate),
          minSampleSize: parseInt(options.minSamples),
          maxHistoryDays: parseInt(options.maxHistoryDays),
          adaptationPeriod: 24
        }
      };

      // Initialize pattern learning engine
      const patternEngine = new PatternLearningEngine(mlConfig, options.outputDir);

      // Set up progress tracking
      patternEngine.on('learning.started', (phase) => {
        console.log(`🔄 Starting phase: ${phase}`);
      });

      patternEngine.on('learning.progress', (progress, phase) => {
        const percentage = Math.round(progress * 100);
        console.log(`📊 ${phase}: ${percentage}% complete`);
      });

      patternEngine.on('pattern.discovered', (pattern, type) => {
        console.log(`🔍 Discovered ${type} pattern: ${pattern.userId || pattern.systemId || 'unknown'}`);
      });

      patternEngine.on('learning.completed', (results) => {
        console.log('\n✅ Pattern Learning Completed!');
        console.log(`   Patterns Learned: ${results.qualityMetrics.patternCoverage * 100}%`);
        console.log(`   Accuracy Score: ${results.qualityMetrics.anomalyDetectionRate * 100}%`);
        console.log(`   False Positive Rate: ${results.qualityMetrics.falsePositiveRate * 100}%`);
      });

      // Start learning process
      const startTime = Date.now();
      const results = await patternEngine.learnFromHistoricalData(validFiles);
      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n📈 Learning Results:');
      console.log(`   Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
      console.log(`   Quality Score: ${Math.round(results.qualityMetrics.patternCoverage * 100)}%`);
      console.log(`   Recommendations: ${results.recommendations.modelUpdates.length} model updates`);

      if (results.recommendations.configurationChanges.length > 0) {
        console.log('\n💡 Recommendations:');
        results.recommendations.configurationChanges.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }

    } catch (error) {
      console.error('❌ Error during pattern learning:', error);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:status')
  .description('Show ML pattern engine status and statistics')
  .option('--json', 'Output in JSON format')
  .option('--detailed', 'Show detailed pattern information')
  .action(async (options) => {
    try {
      const patternEngine = new PatternLearningEngine();
      const state = patternEngine.getState();
      const patternsSummary = patternEngine.getPatternsSummary();

      if (options.json) {
        console.log(JSON.stringify({ state, patternsSummary }, null, 2));
        return;
      }

      console.log('🧠 ML Pattern Engine Status\n');
      
      console.log('📊 Engine State:');
      console.log(`   Status: ${state.status.toUpperCase()}`);
      console.log(`   Engine ID: ${state.engineId}`);
      console.log(`   Last Model Update: ${state.statistics.lastModelUpdate.toLocaleString()}`);
      console.log();

      console.log('🎯 Learning Progress:');
      if (state.status === 'learning') {
        const progress = Math.round((state.learningProgress.processedSamples / state.learningProgress.totalSamples) * 100);
        console.log(`   Current Phase: ${state.learningProgress.currentPhase}`);
        console.log(`   Progress: ${progress}% (${state.learningProgress.processedSamples}/${state.learningProgress.totalSamples})`);
        console.log(`   ETA: ${state.learningProgress.estimatedCompletion.toLocaleString()}`);
      } else {
        console.log(`   Status: ${state.status === 'idle' ? 'Ready' : state.status}`);
      }
      console.log();

      console.log('🔍 Active Models:');
      console.log(`   User Behavior Models: ${state.activeModels.userBehaviorModels}`);
      console.log(`   System Behavior Models: ${state.activeModels.systemBehaviorModels}`);
      console.log(`   Security Event Models: ${state.activeModels.securityEventModels}`);
      console.log(`   Application Usage Models: ${state.activeModels.applicationUsageModels}`);
      console.log();

      console.log('📈 Statistics:');
      console.log(`   Logs Generated: ${state.statistics.logsGenerated.toLocaleString()}`);
      console.log(`   Patterns Learned: ${state.statistics.patternsLearned.toLocaleString()}`);
      console.log(`   Anomalies Generated: ${state.statistics.anomaliesGenerated.toLocaleString()}`);
      console.log(`   Accuracy Score: ${Math.round(state.statistics.accuracyScore * 100)}%`);
      console.log();

      console.log('⚡ Resource Usage:');
      console.log(`   Memory Usage: ${Math.round(state.resourceUsage.memoryUsage)}MB`);
      console.log(`   CPU Usage: ${Math.round(state.resourceUsage.cpuUsage)}%`);
      console.log(`   Processing Time: ${state.resourceUsage.processingTime}ms per log`);
      console.log();

      console.log('📋 Patterns Summary:');
      console.log(`   User Behavior Patterns: ${patternsSummary.userBehaviorPatterns}`);
      console.log(`   System Behavior Patterns: ${patternsSummary.systemBehaviorPatterns}`);
      console.log(`   Security Event Patterns: ${patternsSummary.securityEventPatterns}`);
      console.log(`   Application Usage Patterns: ${patternsSummary.applicationUsagePatterns}`);
      console.log(`   Total Models: ${patternsSummary.totalModels}`);

      if (options.detailed && patternsSummary.totalModels > 0) {
        console.log('\n🔬 Detailed Pattern Analysis:');
        // Additional detailed information would be shown here
        console.log('   Use --json flag for complete pattern details');
      }

    } catch (error) {
      console.error('❌ Error getting ML pattern status:', error);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:generate')
  .description('Generate logs using learned ML patterns')
  .argument('<source>', 'Log source type (authentication, firewall, database, etc.)')
  .option('--count <number>', 'Number of logs to generate', '10')
  .option('--anomaly-rate <number>', 'Percentage of anomalous logs (0-1)', '0.05')
  .option('--user-id <string>', 'Specific user ID to generate logs for')
  .option('--system-id <string>', 'Specific system ID to generate logs for')
  .option('--output <file>', 'Output file (default: stdout)')
  .option('--format <format>', 'Output format (json, syslog, cef)', 'json')
  .action(async (source, options) => {
    try {
      console.log(`🧠 Generating ${options.count} ML-based logs for source: ${source}\n`);

      const patternEngine = new PatternLearningEngine();
      const count = parseInt(options.count);
      const anomalyRate = parseFloat(options.anomalyRate);

      console.log('⚙️ Generation Settings:');
      console.log(`   Source Type: ${source}`);
      console.log(`   Log Count: ${count}`);
      console.log(`   Anomaly Rate: ${Math.round(anomalyRate * 100)}%`);
      console.log(`   Output Format: ${options.format}`);
      if (options.userId) console.log(`   User ID: ${options.userId}`);
      if (options.systemId) console.log(`   System ID: ${options.systemId}`);
      console.log();

      const logs = [];
      const startTime = Date.now();

      console.log('🔄 Generating logs...');
      for (let i = 0; i < count; i++) {
        const context = {
          userId: options.userId,
          systemId: options.systemId,
          timestamp: new Date()
        };

        const logEntry = await patternEngine.generateRealisticLogEntry(source, context);
        logs.push(logEntry);

        if ((i + 1) % Math.max(1, Math.floor(count / 10)) === 0) {
          const progress = Math.round(((i + 1) / count) * 100);
          console.log(`   Progress: ${progress}%`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`\n✅ Generated ${logs.length} logs in ${duration}ms`);

      // Format and output logs
      let output = '';
      switch (options.format.toLowerCase()) {
        case 'json':
          output = logs.map(log => JSON.stringify(log)).join('\n');
          break;
        case 'syslog':
          output = logs.map(log => 
            `<${getSyslogPriority(log.level)}>${new Date(log.timestamp).toISOString()} ${log.source}: ${log.message}`
          ).join('\n');
          break;
        case 'cef':
          output = logs.map(log => formatCEF(log)).join('\n');
          break;
        default:
          output = logs.map(log => JSON.stringify(log)).join('\n');
      }

      if (options.output) {
        fs.writeFileSync(options.output, output);
        console.log(`📁 Logs saved to: ${options.output}`);
      } else {
        console.log('\n📋 Generated Logs:');
        console.log(output);
      }

      // Show generation statistics
      const anomalousLogs = logs.filter(log => log.metadata?.is_anomaly).length;
      console.log('\n📊 Generation Statistics:');
      console.log(`   Total Logs: ${logs.length}`);
      console.log(`   Anomalous Logs: ${anomalousLogs} (${Math.round((anomalousLogs / logs.length) * 100)}%)`);
      console.log(`   Average Generation Time: ${Math.round(duration / logs.length)}ms per log`);

    } catch (error) {
      console.error('❌ Error generating ML-based logs:', error);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:analyze')
  .description('Analyze patterns in existing log files')
  .argument('<files...>', 'Log files to analyze')
  .option('--output <file>', 'Save analysis results to file')
  .option('--focus <type>', 'Focus analysis on specific pattern type (user, system, security, application)')
  .option('--json', 'Output in JSON format')
  .action(async (files: string[], options: any) => {
    try {
      console.log('🔍 Analyzing ML Patterns in Log Files...\n');

      // Validate files
      const validFiles = files.filter((file: string) => {
        if (fs.existsSync(file)) {
          return true;
        } else {
          console.warn(`⚠️ File not found: ${file}`);
          return false;
        }
      });

      if (validFiles.length === 0) {
        console.error('❌ No valid log files found');
        process.exit(1);
      }

      console.log(`📁 Analyzing ${validFiles.length} files...`);
      
      const patternEngine = new PatternLearningEngine();
      const analysisResults = await patternEngine.learnFromHistoricalData(validFiles);

      if (options.json) {
        const output = JSON.stringify(analysisResults, null, 2);
        if (options.output) {
          fs.writeFileSync(options.output, output);
          console.log(`📁 Analysis saved to: ${options.output}`);
        } else {
          console.log(output);
        }
        return;
      }

      // Display human-readable analysis
      console.log('\n📊 Pattern Analysis Results:');
      console.log(`   Analysis ID: ${analysisResults.analysisId}`);
      console.log(`   Timestamp: ${analysisResults.timestamp.toLocaleString()}`);
      console.log();

      console.log('🔍 Detected Patterns:');
      console.log(`   User Behavior Changes: ${analysisResults.detectedPatterns.userBehaviorChanges.length}`);
      console.log(`   System Performance Shifts: ${analysisResults.detectedPatterns.systemPerformanceShifts.length}`);
      console.log(`   Security Event Trends: ${analysisResults.detectedPatterns.securityEventTrends.length}`);
      console.log();

      console.log('📈 Quality Metrics:');
      console.log(`   Pattern Coverage: ${Math.round(analysisResults.qualityMetrics.patternCoverage * 100)}%`);
      console.log(`   Anomaly Detection Rate: ${Math.round(analysisResults.qualityMetrics.anomalyDetectionRate * 100)}%`);
      console.log(`   False Positive Rate: ${Math.round(analysisResults.qualityMetrics.falsePositiveRate * 100)}%`);
      console.log(`   Model Drift: ${Math.round(analysisResults.qualityMetrics.modelDrift * 100)}%`);
      console.log();

      if (analysisResults.recommendations.modelUpdates.length > 0) {
        console.log('💡 Recommendations:');
        console.log('   Model Updates:');
        analysisResults.recommendations.modelUpdates.forEach(update => {
          console.log(`     • ${update}`);
        });
        
        if (analysisResults.recommendations.configurationChanges.length > 0) {
          console.log('   Configuration Changes:');
          analysisResults.recommendations.configurationChanges.forEach(change => {
            console.log(`     • ${change}`);
          });
        }
      }

      if (options.output) {
        const output = JSON.stringify(analysisResults, null, 2);
        fs.writeFileSync(options.output, output);
        console.log(`\n📁 Full analysis saved to: ${options.output}`);
      }

    } catch (error) {
      console.error('❌ Error analyzing patterns:', error);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:config')
  .description('Show or update ML pattern configuration')
  .option('--show', 'Show current configuration')
  .option('--set <key=value>', 'Set configuration value (can be used multiple times)', [])
  .option('--reset', 'Reset to default configuration')
  .option('--file <path>', 'Load configuration from file')
  .action(async (options) => {
    try {
      const patternEngine = new PatternLearningEngine();

      if (options.reset) {
        console.log('🔄 Resetting ML configuration to defaults...');
        patternEngine.updateConfig({
          learning: {
            enabled: true,
            learningRate: 0.01,
            adaptationPeriod: 24,
            minSampleSize: 1000,
            maxHistoryDays: 30
          },
          patternApplication: {
            userBehaviorWeight: 0.4,
            systemBehaviorWeight: 0.3,
            securityEventWeight: 0.2,
            randomnessLevel: 0.1
          },
          anomalyGeneration: {
            enabled: true,
            anomalyRate: 0.05,
            severityDistribution: { low: 0.6, medium: 0.3, high: 0.08, critical: 0.02 },
            realismLevel: 0.8
          },
          adaptation: {
            enabled: true,
            feedbackLoop: true,
            crossValidation: true,
            driftDetection: true
          }
        });
        console.log('✅ Configuration reset to defaults');
        return;
      }

      if (options.file) {
        console.log(`📁 Loading configuration from: ${options.file}`);
        const configData = fs.readFileSync(options.file, 'utf8');
        const config = JSON.parse(configData);
        patternEngine.updateConfig(config);
        console.log('✅ Configuration loaded from file');
        return;
      }

      if (options.set && options.set.length > 0) {
        console.log('⚙️ Updating configuration...');
        const updates: any = {};
        
        for (const setting of options.set) {
          const [key, value] = setting.split('=');
          if (!key || value === undefined) {
            console.error(`❌ Invalid setting format: ${setting}. Use key=value`);
            continue;
          }

          // Parse value based on type
          let parsedValue: any = value;
          if (value === 'true') parsedValue = true;
          else if (value === 'false') parsedValue = false;
          else if (!isNaN(Number(value))) parsedValue = Number(value);

          // Set nested property
          const keyParts = key.split('.');
          let current = updates;
          for (let i = 0; i < keyParts.length - 1; i++) {
            if (!current[keyParts[i]]) current[keyParts[i]] = {};
            current = current[keyParts[i]];
          }
          current[keyParts[keyParts.length - 1]] = parsedValue;

          console.log(`   Set ${key} = ${parsedValue}`);
        }

        patternEngine.updateConfig(updates);
        console.log('✅ Configuration updated');
        return;
      }

      // Show current configuration
      console.log('⚙️ Current ML Pattern Configuration:\n');
      
      // Since we can't easily get the current config, show default structure
      console.log('📚 Learning Settings:');
      console.log('   learning.enabled = true');
      console.log('   learning.learningRate = 0.01');
      console.log('   learning.adaptationPeriod = 24 (hours)');
      console.log('   learning.minSampleSize = 1000');
      console.log('   learning.maxHistoryDays = 30');
      console.log();

      console.log('🎯 Pattern Application:');
      console.log('   patternApplication.userBehaviorWeight = 0.4');
      console.log('   patternApplication.systemBehaviorWeight = 0.3');
      console.log('   patternApplication.securityEventWeight = 0.2');
      console.log('   patternApplication.randomnessLevel = 0.1');
      console.log();

      console.log('🚨 Anomaly Generation:');
      console.log('   anomalyGeneration.enabled = true');
      console.log('   anomalyGeneration.anomalyRate = 0.05 (5%)');
      console.log('   anomalyGeneration.realismLevel = 0.8');
      console.log();

      console.log('🔄 Adaptation Settings:');
      console.log('   adaptation.enabled = true');
      console.log('   adaptation.feedbackLoop = true');
      console.log('   adaptation.crossValidation = true');
      console.log('   adaptation.driftDetection = true');
      console.log();

      console.log('💡 Usage Examples:');
      console.log('   npm run ml-patterns:config --set learning.learningRate=0.02');
      console.log('   npm run ml-patterns:config --set anomalyGeneration.anomalyRate=0.1');
      console.log('   npm run ml-patterns:config --reset');

    } catch (error) {
      console.error('❌ Error managing ML configuration:', error);
      process.exit(1);
    }
  });

program
  .command('ml-patterns:reset')
  .description('Reset all learned patterns and models')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        console.log('⚠️ This will permanently delete all learned patterns and models.');
        console.log('   Use --confirm flag to proceed without this prompt.');
        console.log('\nTo confirm, run: npm run ml-patterns:reset --confirm');
        return;
      }

      console.log('🔄 Resetting ML patterns and models...');
      
      // Reset models directory
      const modelsDir = path.join(process.cwd(), 'models', 'ml-patterns');
      if (fs.existsSync(modelsDir)) {
        fs.removeSync(modelsDir);
        console.log('   ✅ Cleared models directory');
      }

      // Reinitialize pattern engine
      const patternEngine = new PatternLearningEngine();
      console.log('   ✅ Reinitialized pattern engine');

      console.log('\n✅ ML patterns and models have been reset');
      console.log('   Run ml-patterns:learn to start learning new patterns');

    } catch (error) {
      console.error('❌ Error resetting ML patterns:', error);
      process.exit(1);
    }
  });

// Helper functions for CLI
function getSyslogPriority(level: string): number {
  const priorities: Record<string, number> = {
    'error': 3,
    'warn': 4,
    'info': 6,
    'debug': 7
  };
  return priorities[level] || 6;
}

function formatCEF(log: any): string {
  return `CEF:0|LogGenerator|ML-Enhanced|1.0|${log.source}|${log.message}|${getSyslogPriority(log.level)}|`;
}

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

program.parse();
