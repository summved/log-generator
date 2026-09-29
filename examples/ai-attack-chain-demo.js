#!/usr/bin/env node

/**
 * AI-Enhanced Attack Chain Demonstration
 *
 * Walks through the enhancement options, a preview, a quick simulated run and
 * the execution history of the EnhancedAttackChainManager.
 *
 * Run `npm run build` first; this example uses the compiled code in dist/.
 */

const { EnhancedAttackChainManager } = require('../dist/stubs/WorkingAIFeatures');

async function demonstrateAIAttackChains() {
  console.log('🤖 AI-Enhanced Attack Chain Demonstration\n');

  const manager = new EnhancedAttackChainManager();
  const chain = 'ransomware-ryuk';

  // 1. Variation options for one chain
  const options = manager.getEnhancementOptions(chain);
  console.log(`📋 ${options.chain.name} (${options.chain.category}, ${options.chain.difficulty})\n`);
  console.log(`🎛️ Modes: ${options.modes.join(', ')}`);
  console.log('\n🎯 Levels:');
  options.levels.forEach(level => console.log(`   ${level.level.padEnd(9)} ${level.description}`));

  // 2. Preview: real chain details and estimates from the template
  const preview = await manager.previewEnhancement(chain, 'enhanced', 'medium');
  console.log(`\n👁️ Preview (mode ${preview.mode}, level ${preview.aiLevel})`);
  console.log(`   Steps: ${preview.chain.stepCount}  |  Techniques: ${preview.techniques.join(', ')}`);
  console.log('   Planned changes:');
  preview.plannedChanges.forEach(change => console.log(`     • ${change.description}`));
  console.log(`   At 1x speed: ~${Math.round(preview.estimatedDurationMs / 60000)} minutes, ~${preview.estimatedLogs} logs`);

  // 3. Quick simulated runs (no logs are written in simulation mode)
  console.log('\n⚡ Simulated runs:');
  for (const [mode, aiLevel] of [['static', 'basic'], ['enhanced', 'medium'], ['dynamic', 'high']]) {
    const execution = await manager.executeEnhancedChain(chain, { mode, aiLevel });
    const changes = execution.plannedChanges.map(change => change.description).join('; ');
    console.log(`   ${mode.padEnd(9)} ${aiLevel.padEnd(7)} ${execution.status} (${execution.executionMode}) - ${changes}`);
  }

  // 4. History of the runs above
  const history = manager.getExecutionHistory(10);
  console.log(`\n📊 History: ${history.statistics.totalExecutions} executions`);
  console.log(`   Modes:  ${JSON.stringify(history.statistics.modeDistribution)}`);
  console.log(`   Levels: ${JSON.stringify(history.statistics.levelDistribution)}`);

  console.log('\nTo write real attack chain logs, run for example:');
  console.log('   npm run attack-chains:execute ransomware-ryuk -- --duration 1m');
}

if (require.main === module) {
  demonstrateAIAttackChains().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { demonstrateAIAttackChains };
