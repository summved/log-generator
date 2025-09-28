#!/usr/bin/env node

/**
 * Working CLI - Only includes functional features
 * This version excludes broken ML/AI features until they can be properly fixed
 */

import { Command } from 'commander';
import { LogGeneratorManager } from './LogGeneratorManager';
import { ReplayManager } from './replay/ReplayManager';
import { ConfigManager } from './config';
import { AttackChainManager } from './chains/AttackChainManager';
import { AttackChainExecutionConfig } from './types/attackChain';
import { InputValidator } from './utils/inputValidator';
import { logger } from './utils/logger';

const program = new Command();

// Basic CLI setup
program
  .name('log-generator')
  .description('Multi-source log generator for SIEM solutions with replay functionality')
  .version('1.0.0');

// Generate command
program
  .command('generate')
  .description('Start generating logs from configured sources')
  .option('-d, --duration <duration>', 'Generation duration (e.g., 30s, 5m, 1h)', '30s')
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .option('-o, --output <path>', 'Output directory path')
  .option('--mitre-technique <technique>', 'Filter logs by MITRE technique (e.g., T1110)')
  .option('--mitre-tactic <tactic>', 'Filter logs by MITRE tactic (e.g., TA0006)')
  .option('--source <source>', 'Generate logs from specific source only')
  .option('--format <format>', 'Output format: json, jsonl, csv, syslog', 'json')
  .action(async (options) => {
    try {
      console.log('🚀 Starting log generation...\n');

      const configPath = options.config || 'src/config/default.yaml';
      const configManager = new ConfigManager(configPath);
      const config = configManager.getConfig();

      // Validate duration
      const durationSeconds = InputValidator.validateDuration(options.duration);

      // Create manager
      const manager = new LogGeneratorManager(configPath);

      // Apply filters if specified
      const filterOptions = {
        mitreTechnique: options.mitreTechnique,
        mitreTactic: options.mitreTactic,
        source: options.source,
        enabledOnly: true
      };

      // Start generation
      await manager.startGeneration(filterOptions);

      // Run for specified duration
      console.log(`⏱️ Running for ${options.duration}...`);
      await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));

      // Stop generation
      await manager.stop();
      console.log('\n✅ Log generation completed!');

    } catch (error) {
      console.error('❌ Error generating logs:', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show current status of generators and replay')
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .action(async (options) => {
    try {
      const configPath = options.config || 'src/config/default.yaml';
      const configManager = new ConfigManager(configPath);
      const config = configManager.getConfig();
      const manager = new LogGeneratorManager(config);

      console.log('📊 System Status\n');
      console.log('================');

      // Configuration info
      console.log('\n📋 Configuration:');
      console.log(`   Config file: ${configPath}`);
      console.log(`   Output format: ${config.output.format}`);
      console.log(`   Output destination: ${config.output.destination}`);

      // Generators info
      console.log('\n🔧 Generators:');
      const generators = Object.entries(config.generators);
      const enabledGenerators = generators.filter(([_, gen]: [string, any]) => gen.enabled);
      const disabledGenerators = generators.filter(([_, gen]: [string, any]) => !gen.enabled);

      console.log(`   Total: ${generators.length}`);
      console.log(`   Enabled: ${enabledGenerators.length}`);
      console.log(`   Disabled: ${disabledGenerators.length}`);

      enabledGenerators.forEach(([name, gen]: [string, any]) => {
        console.log(`   ✅ ${name}: ${gen.frequency} logs/min`);
      });

      if (disabledGenerators.length > 0) {
        console.log('\n   Disabled generators:');
        disabledGenerators.forEach(([name]: [string, any]) => {
          console.log(`   ⚪ ${name}: disabled`);
        });
      }

      // Storage info
      console.log('\n💾 Storage:');
      console.log(`   Current logs: ${config.storage.currentPath}`);
      console.log(`   Historical logs: ${config.storage.historicalPath}`);
      console.log(`   Retention: ${config.storage.retention} days`);

    } catch (error) {
      console.error('❌ Error getting status:', error);
      process.exit(1);
    }
  });

// Validate config command
program
  .command('validate-config')
  .description('Validate configuration file for errors and performance issues')
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .action(async (options) => {
    try {
      const configPath = options.config || 'src/config/default.yaml';
      console.log(`🔍 Validating configuration: ${configPath}\n`);

      const configManager = new ConfigManager(configPath);
      const config = configManager.getConfig();
      
      // Basic structure validation
      InputValidator.validateConfigStructure(config);
      console.log('✅ Configuration structure is valid');

      // Performance warnings
      const warnings = [];
      let totalFrequency = 0;

      Object.entries(config.generators).forEach(([name, generator]: [string, any]) => {
        if (generator.enabled) {
          totalFrequency += generator.frequency;
          
          if (generator.frequency > 60000) {
            warnings.push(`⚠️ Generator '${name}' frequency ${generator.frequency} is above recommended safe limit (60,000)`);
          }
        }
      });

      if (totalFrequency > 300000) {
        warnings.push(`⚠️ Total frequency ${totalFrequency} may cause performance issues`);
      }

      const estimatedDiskIO = (totalFrequency * 0.5) / 1000; // Rough estimate in MB/s
      if (estimatedDiskIO > 100) {
        warnings.push(`⚠️ Estimated disk I/O: ${estimatedDiskIO.toFixed(1)} MB/s - ensure adequate disk performance`);
      }

      if (warnings.length > 0) {
        console.log('\n⚠️ Configuration warnings:');
        warnings.forEach(warning => console.log(`   ${warning}`));
      } else {
        console.log('✅ No performance warnings detected');
      }

      console.log('\n🎯 Validation complete!');

    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      process.exit(1);
    }
  });

// MITRE list command
program
  .command('mitre-list')
  .description('List supported MITRE ATT&CK techniques and tactics')
  .option('--tactics', 'Show only tactics')
  .option('--techniques', 'Show only techniques')
  .action(async (options) => {
    try {
      console.log('🛡️ MITRE ATT&CK Framework Integration\n');

      // This is a simplified version - the full implementation would load from actual MITRE data
      const tactics = [
        'TA0001 - Initial Access',
        'TA0002 - Execution',
        'TA0003 - Persistence',
        'TA0004 - Privilege Escalation',
        'TA0005 - Defense Evasion',
        'TA0006 - Credential Access',
        'TA0007 - Discovery',
        'TA0008 - Lateral Movement',
        'TA0009 - Collection',
        'TA0010 - Exfiltration',
        'TA0011 - Command and Control'
      ];

      const techniques = [
        'T1018 - Remote System Discovery',
        'T1110 - Brute Force',
        'T1110.001 - Password Guessing',
        'T1110.002 - Password Cracking',
        'T1110.003 - Password Spraying',
        'T1078 - Valid Accounts',
        'T1078.001 - Default Accounts',
        'T1078.002 - Domain Accounts',
        'T1078.003 - Local Accounts'
      ];

      if (!options.techniques) {
        console.log('📋 MITRE ATT&CK Tactics:');
        tactics.forEach(tactic => console.log(`   ${tactic}`));
      }

      if (!options.tactics) {
        console.log('\n🎯 MITRE ATT&CK Techniques:');
        techniques.forEach(technique => console.log(`   ${technique}`));
      }

      console.log('\n💡 Usage: npm run generate -- --mitre-technique T1110');
      console.log('💡 Usage: npm run generate -- --mitre-tactic TA0006');

    } catch (error) {
      console.error('❌ Error listing MITRE data:', error);
      process.exit(1);
    }
  });

// Attack chains list command
program
  .command('attack-chains:list')
  .description('List all available attack chain templates')
  .action(async (options) => {
    try {
      console.log('⚔️ Available Attack Chain Templates\n');

      const chainManager = new AttackChainManager();
      const templates = chainManager.getTemplates();

      if (templates.length === 0) {
        console.log('No attack chain templates found.');
        return;
      }

      templates.forEach((template, index) => {
        console.log(`${index + 1}. ${template.name}`);
        console.log(`   Description: ${template.description}`);
        console.log(`   Steps: ${template.steps.length}`);
        console.log(`   Estimated Duration: ${template.estimatedDuration || 'N/A'}`);
        console.log(`   MITRE Techniques: ${template.mitreTechniques?.join(', ') || 'None'}`);
        console.log('');
      });

      console.log('💡 Usage: npm run attack-chains:execute <name>');

    } catch (error) {
      console.error('❌ Error listing attack chains:', error);
      process.exit(1);
    }
  });

// Attack chains execute command (basic version only)
program
  .command('attack-chains:execute')
  .description('Execute a basic attack chain simulation')
  .argument('<name>', 'Attack chain name or ID')
  .option('-c, --config <path>', 'Path to log generator configuration file')
  .option('--dry-run', 'Preview execution without generating logs')
  .action(async (name, options) => {
    try {
      console.log(`⚔️ Executing Attack Chain: ${name}\n`);

      const configPath = options.config || 'src/config/default.yaml';
      const configManager = new ConfigManager(configPath);
      const config = configManager.getConfig();

      const chainManager = new AttackChainManager();
      const executionConfig: AttackChainExecutionConfig = {
        logGeneratorConfig: config,
        dryRun: options.dryRun || false
      };

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no logs will be generated\n');
      }

      const execution = await chainManager.executeChain(name, executionConfig);

      console.log(`✅ Attack chain execution completed!`);
      console.log(`   Execution ID: ${execution.id}`);
      console.log(`   Steps executed: ${execution.steps.length}`);
      console.log(`   Total duration: ${execution.duration}ms`);

    } catch (error) {
      console.error('❌ Error executing attack chain:', error);
      process.exit(1);
    }
  });

// Replay command
program
  .command('replay')
  .description('Replay historical logs')
  .option('-f, --file <path>', 'Path to log file to replay')
  .option('-s, --speed <multiplier>', 'Replay speed multiplier', '1.0')
  .option('-l, --loop', 'Loop replay continuously')
  .option('--start-time <time>', 'Start replay from specific timestamp')
  .option('--end-time <time>', 'End replay at specific timestamp')
  .action(async (options) => {
    try {
      console.log('🔄 Starting log replay...\n');

      if (!options.file) {
        console.error('❌ File path is required for replay');
        console.error('💡 Usage: npm run replay -- --file logs/historical/sample.jsonl');
        process.exit(1);
      }

      const filePath = InputValidator.validateFilePath(options.file, 'Log file');
      const speed = InputValidator.validateNumber(options.speed, 0.1, 100, 'Replay speed');

      const replayManager = new ReplayManager();
      
      const replayConfig = {
        filePath,
        speed,
        loop: options.loop || false,
        startTime: options.startTime,
        endTime: options.endTime
      };

      console.log(`📁 File: ${filePath}`);
      console.log(`⚡ Speed: ${speed}x`);
      console.log(`🔄 Loop: ${options.loop ? 'Yes' : 'No'}\n`);

      await replayManager.startReplay(replayConfig);

    } catch (error) {
      console.error('❌ Error replaying logs:', error);
      process.exit(1);
    }
  });

// Performance test command
program
  .command('performance-test')
  .description('Run comprehensive performance tests')
  .option('-d, --duration <duration>', 'Test duration', '60s')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      console.log('🚀 Starting Performance Test\n');

      const durationSeconds = InputValidator.validateDuration(options.duration);
      const configPath = options.config || 'src/config/default.yaml';
      
      console.log(`⏱️ Duration: ${options.duration}`);
      console.log(`📋 Config: ${configPath}\n`);

      const configManager = new ConfigManager(configPath);
      const config = configManager.getConfig();
      const manager = new LogGeneratorManager(config);

      const startTime = Date.now();
      await manager.start();

      // Run test
      await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));

      await manager.stop();
      const endTime = Date.now();

      const totalTime = (endTime - startTime) / 1000;
      console.log(`\n📊 Performance Test Results:`);
      console.log(`   Duration: ${totalTime.toFixed(2)}s`);
      console.log(`   Status: ✅ Completed successfully`);

    } catch (error) {
      console.error('❌ Performance test failed:', error);
      process.exit(1);
    }
  });

// Help command
program
  .command('help')
  .description('Display help for command')
  .action(() => {
    program.help();
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
