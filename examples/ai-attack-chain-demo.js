#!/usr/bin/env node

/**
 * AI-Enhanced Attack Chain Demonstration
 * 
 * This example showcases the power of AI-enhanced attack chains:
 * - Static vs Enhanced vs Dynamic modes
 * - Progressive training sessions
 * - AI-driven technique substitution and evasion
 * - Local AI with NO external dependencies
 */

const { EnhancedAttackChainManager } = require('../dist/chains/EnhancedAttackChainManager');
const { logger } = require('../dist/utils/logger');

async function demonstrateAIAttackChains() {
  console.log('🤖 AI-Enhanced Attack Chain Demonstration\n');
  
  const enhancedManager = new EnhancedAttackChainManager();

  // 1. Show available enhancement options
  console.log('📋 Available Enhancement Options for Ryuk Ransomware:\n');
  try {
    const options = enhancedManager.getEnhancementOptions('ransomware-ryuk');
    
    console.log(`Chain: ${options.template.name}`);
    console.log(`Category: ${options.template.category}`);
    console.log(`Difficulty: ${options.template.difficulty}\n`);

    console.log('🎛️ Enhancement Modes:');
    options.availableModes.forEach(mode => {
      console.log(`  ${mode.mode.toUpperCase()}:`);
      console.log(`    Description: ${mode.description}`);
      console.log(`    Requirements: ${mode.requirements.join(', ')}\n`);
    });

    console.log('🎯 AI Levels:');
    options.availableLevels.forEach(level => {
      console.log(`  ${level.level.toUpperCase()}:`);
      console.log(`    Description: ${level.description}`);
      console.log(`    Features: ${level.features.join(', ')}\n`);
    });

    console.log('💡 Recommendations:');
    console.log(`  Beginner: --mode ${options.recommendations.beginnerMode} --ai-level ${options.recommendations.beginnerLevel}`);
    console.log(`  Expert: --mode ${options.recommendations.expertMode} --ai-level ${options.recommendations.expertLevel}\n`);

  } catch (error) {
    console.error('❌ Error showing enhancement options:', error.message);
  }

  // 2. Preview enhancements without execution
  console.log('👁️ Previewing AI Enhancements:\n');
  
  try {
    const preview = await enhancedManager.previewEnhancement('ransomware-ryuk', 'enhanced', 'medium');
    
    console.log(`📋 Original Chain: ${preview.originalChain.name}`);
    console.log(`   Steps: ${preview.originalChain.chain.steps.length}`);
    console.log();

    console.log(`🤖 Enhanced Chain:`);
    console.log(`   Enhancement Mode: enhanced`);
    console.log(`   AI Level: medium`);
    console.log(`   Enhancement Type: ${preview.enhancedChain.enhancementType}`);
    console.log(`   AI Generated: ${preview.enhancedChain.aiGenerated ? 'Yes' : 'No'}`);
    console.log(`   Confidence Score: ${preview.enhancedChain.metadata.confidenceScore.toFixed(2)}`);
    console.log(`   Realism Score: ${preview.enhancedChain.metadata.realismScore.toFixed(2)}`);
    console.log();

    console.log(`📝 Enhancements Applied:`);
    preview.changes.forEach(change => {
      console.log(`   ✓ ${change}`);
    });
    console.log();

    console.log(`⏱️ Estimated Impact:`);
    console.log(`   Duration: ~${Math.round(preview.estimatedDuration / 60000)} minutes`);
    console.log(`   Logs: ~${preview.estimatedLogs} log entries\n`);

  } catch (error) {
    console.error('❌ Error previewing enhancement:', error.message);
  }

  // 3. Execute static mode (original behavior)
  console.log('📊 Executing Static Mode (Original):\n');
  
  try {
    const staticExecution = await enhancedManager.executeEnhancedChain('ransomware-ryuk', {
      mode: 'static',
      aiLevel: 'basic',
      variations: 1
    });

    console.log('✅ Static Execution Completed:');
    console.log(`   Mode: ${staticExecution.enhancementConfig.mode}`);
    console.log(`   AI Enhanced: ${staticExecution.enhancedChain.aiGenerated ? 'Yes' : 'No'}`);
    console.log(`   Logs Generated: ${staticExecution.stats.logsGenerated}`);
    console.log(`   Duration: ${Math.round(staticExecution.stats.actualDuration / 1000)}s`);
    console.log(`   Enhancement Time: ${staticExecution.aiMetrics.enhancementTime}ms\n`);

  } catch (error) {
    console.error('❌ Error executing static mode:', error.message);
  }

  // 4. Execute enhanced mode with AI improvements
  console.log('🤖 Executing Enhanced Mode with AI:\n');
  
  try {
    const enhancedExecution = await enhancedManager.executeEnhancedChain('ransomware-ryuk', {
      mode: 'enhanced',
      aiLevel: 'medium',
      variations: 1,
      enableEvasion: true,
      adaptiveDelays: true
    });

    console.log('✅ AI-Enhanced Execution Completed:');
    console.log(`   Mode: ${enhancedExecution.enhancementConfig.mode}`);
    console.log(`   AI Level: ${enhancedExecution.enhancementConfig.aiLevel}`);
    console.log(`   AI Enhanced: ${enhancedExecution.enhancedChain.aiGenerated ? 'Yes' : 'No'}`);
    console.log(`   Enhancement Type: ${enhancedExecution.enhancedChain.enhancementType}`);
    console.log(`   Logs Generated: ${enhancedExecution.stats.logsGenerated}`);
    console.log(`   Duration: ${Math.round(enhancedExecution.stats.actualDuration / 1000)}s`);
    console.log(`   Enhancement Time: ${enhancedExecution.aiMetrics.enhancementTime}ms`);
    console.log(`   Confidence Score: ${enhancedExecution.aiMetrics.confidenceScore.toFixed(2)}`);
    console.log(`   Realism Score: ${enhancedExecution.aiMetrics.realismScore.toFixed(2)}\n`);

    // Show some enhanced steps
    if (enhancedExecution.enhancedChain.steps && enhancedExecution.enhancedChain.steps.length > 0) {
      console.log('🔍 Sample Enhanced Steps:');
      enhancedExecution.enhancedChain.steps.slice(0, 3).forEach((step, index) => {
        console.log(`   Step ${index + 1}: ${step.name}`);
        console.log(`     MITRE Technique: ${step.mitre.technique}`);
        console.log(`     Duration: ${step.timing.duration}ms`);
        if (step.logGeneration?.customData?.evasion_tactic) {
          console.log(`     Evasion Tactic: ${step.logGeneration.customData.evasion_tactic}`);
        }
        if (step.logGeneration?.customData?.ai_enhanced) {
          console.log(`     AI Enhanced: Yes`);
        }
        console.log();
      });
    }

  } catch (error) {
    console.error('❌ Error executing enhanced mode:', error.message);
  }

  // 5. Run a mini training session
  console.log('🎓 Running Mini Training Session (3 Variations):\n');
  
  try {
    const trainingExecutions = await enhancedManager.executeTrainingSession('ransomware-ryuk', {
      variationCount: 3,
      progressiveMode: true,
      delayBetweenVariations: 5000, // 5 seconds
    });

    console.log('✅ Training Session Completed:');
    console.log(`   Total Variations: ${trainingExecutions.length}`);
    console.log(`   Total Logs: ${trainingExecutions.reduce((sum, exec) => sum + exec.stats.logsGenerated, 0)}`);
    console.log(`   Total Duration: ${Math.round(trainingExecutions.reduce((sum, exec) => sum + exec.stats.actualDuration, 0) / 1000)}s\n`);

    console.log('📈 Variation Breakdown:');
    trainingExecutions.forEach((execution, index) => {
      console.log(`   Variation ${index + 1}:`);
      console.log(`     Mode: ${execution.enhancementConfig.mode}`);
      console.log(`     AI Level: ${execution.enhancementConfig.aiLevel}`);
      console.log(`     Logs: ${execution.stats.logsGenerated}`);
      console.log(`     Duration: ${Math.round(execution.stats.actualDuration / 1000)}s`);
      console.log(`     Confidence: ${execution.aiMetrics.confidenceScore.toFixed(2)}`);
      console.log(`     Realism: ${execution.aiMetrics.realismScore.toFixed(2)}`);
      console.log();
    });

  } catch (error) {
    console.error('❌ Error running training session:', error.message);
  }

  // 6. Show execution statistics
  console.log('📊 Execution Statistics:\n');
  
  try {
    const history = enhancedManager.getExecutionHistory(10);
    
    console.log(`📈 Recent Execution Summary:`);
    console.log(`   Total Executions: ${history.statistics.totalExecutions}`);
    console.log(`   Recent Executions: ${history.executions.length}`);
    console.log(`   Average Logs: ${history.statistics.averageLogsGenerated}`);
    console.log(`   Average Duration: ${Math.round(history.statistics.averageDuration / 1000)}s\n`);

    console.log(`🎛️ Mode Distribution:`);
    Object.entries(history.statistics.modeDistribution).forEach(([mode, count]) => {
      const percentage = history.executions.length > 0 ? ((count / history.executions.length) * 100).toFixed(1) : '0.0';
      console.log(`   ${mode.toUpperCase()}: ${count} (${percentage}%)`);
    });
    console.log();

    console.log(`🎯 AI Level Distribution:`);
    Object.entries(history.statistics.levelDistribution).forEach(([level, count]) => {
      const percentage = history.executions.length > 0 ? ((count / history.executions.length) * 100).toFixed(1) : '0.0';
      console.log(`   ${level.toUpperCase()}: ${count} (${percentage}%)`);
    });
    console.log();

    if (history.statistics.mostUsedChains.length > 0) {
      console.log(`🏆 Most Used Chains:`);
      history.statistics.mostUsedChains.forEach((chain, index) => {
        console.log(`   ${index + 1}. ${chain.chainName}: ${chain.count} executions`);
      });
    }

  } catch (error) {
    console.error('❌ Error showing statistics:', error.message);
  }

  console.log('\n🎯 AI Attack Chain Demonstration Complete!');
  console.log('\n💡 Key Takeaways:');
  console.log('   ✅ 100% Local AI - No external APIs or tokens required');
  console.log('   ✅ Backward Compatible - Static mode preserves original behavior');
  console.log('   ✅ Infinite Variations - AI creates unique attack patterns every time');
  console.log('   ✅ Progressive Training - Scales from basic to advanced difficulty');
  console.log('   ✅ Realistic Evasion - Living-off-the-land and timing evasion tactics');
  console.log('   ✅ MITRE Intelligence - Built-in technique substitution and mapping');
  console.log('\n🚀 Ready to revolutionize your SOC training and detection testing!');
}

// Run the demonstration
if (require.main === module) {
  demonstrateAIAttackChains().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { demonstrateAIAttackChains };














