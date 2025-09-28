#!/usr/bin/env node

/**
 * D3FEND Integration Demo
 * Demonstrates the enhanced capabilities with D3FEND defensive techniques
 */

const { LogGeneratorManager } = require('../dist/LogGeneratorManager');
const { d3fendMapper } = require('../dist/utils/d3fendMapper');
const { mitreMapper } = require('../dist/utils/mitreMapper');

async function demonstrateD3FENDIntegration() {
  console.log('🛡️  D3FEND Framework Integration Demo');
  console.log('=====================================\n');

  // Show D3FEND capabilities
  console.log('📋 Supported D3FEND Categories:');
  d3fendMapper.getSupportedCategories().forEach(category => {
    console.log(`   • ${category}: ${d3fendMapper.getCategoryDescription(category)}`);
  });

  console.log('\n🔧 Available D3FEND Techniques:');
  d3fendMapper.getSupportedTechniques().forEach(technique => {
    const info = d3fendMapper.getTechniqueInfo(technique);
    console.log(`   • ${technique}: ${info.subcategory} (${info.category})`);
  });

  // Demonstrate attack-defense correlation
  console.log('\n🔗 Attack-Defense Correlation Examples:');
  const attackTechniques = ['T1110', 'T1078', 'T1071', 'T1055'];
  
  attackTechniques.forEach(attackId => {
    const defenses = d3fendMapper.suggestDefensesForAttack(attackId);
    const attackInfo = mitreMapper.getTechniqueInfo(attackId);
    
    console.log(`\n   Attack: ${attackId} - ${attackInfo?.description || 'Unknown'}`);
    console.log('   Recommended Defenses:');
    defenses.forEach(defense => {
      console.log(`     → ${defense.technique}: ${defense.subcategory}`);
      console.log(`       Category: ${defense.category}, Effectiveness: ${defense.effectiveness}`);
    });
  });

  // Show enhanced log generation
  console.log('\n📊 Enhanced Log Generation Examples:');
  
  // Simulate attack log
  const attackLog = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    source: { type: 'authentication', name: 'auth-service' },
    message: 'Multiple failed login attempts detected from 192.168.1.100',
    metadata: { failed_attempts: 15, time_window: '5 minutes' }
  };

  const mitreInfo = mitreMapper.mapLogToTechnique(attackLog.message);
  if (mitreInfo) {
    attackLog.mitre = mitreInfo;
    console.log('\n   🎯 Attack Log with MITRE Mapping:');
    console.log(`      Message: ${attackLog.message}`);
    console.log(`      MITRE: ${mitreInfo.technique} - ${mitreInfo.description}`);
  }

  // Simulate defensive response log
  const defenseLog = {
    timestamp: new Date(Date.now() + 30000).toISOString(), // 30 seconds later
    level: 'INFO',
    source: { type: 'application', name: 'security-platform' },
    message: 'Account locked due to multiple failed attempts - User: suspicious_user',
    metadata: { 
      lockout_duration: '30 minutes',
      automated: true,
      incident_id: 'INC-2024-0157'
    }
  };

  const d3fendInfo = d3fendMapper.mapLogToDefensiveTechnique(defenseLog.message);
  if (d3fendInfo) {
    defenseLog.d3fend = d3fendInfo;
    console.log('\n   🛡️  Defensive Response Log with D3FEND Mapping:');
    console.log(`      Message: ${defenseLog.message}`);
    console.log(`      D3FEND: ${d3fendInfo.technique} - ${d3fendInfo.description}`);
    console.log(`      Category: ${d3fendInfo.category}, Automated: ${d3fendInfo.automated}`);
  }

  console.log('\n🚀 New CLI Commands Available:');
  console.log('   npm run generate -- --d3fend-category Detect --duration 30m');
  console.log('   npm run generate -- --d3fend-technique D3-NTA --count 100');
  console.log('   npm run attack-defense-chains:execute apt29-enhanced --correlation');
  console.log('   npm run d3fend-list --categories');
  console.log('   npm run d3fend-coverage logs/current/*.jsonl');
  console.log('   npm run soc-simulation --scenarios incident-response --duration 1h');

  console.log('\n✨ Enhanced Features:');
  console.log('   • Complete attack-defense simulation scenarios');
  console.log('   • SOC analyst activity logs with realistic timing');
  console.log('   • Defensive technique mapping and correlation');
  console.log('   • Incident response workflow simulation');
  console.log('   • Blue team training scenarios');
  console.log('   • Purple team exercise logs');

  console.log('\n📈 Training Value:');
  console.log('   • 🔴 Red Team: Attack technique logs (MITRE ATT&CK)');
  console.log('   • 🔵 Blue Team: Defensive response logs (D3FEND)');
  console.log('   • 🟣 Purple Team: Correlated attack-defense scenarios');
  console.log('   • 👥 SOC Training: Realistic analyst workflow logs');

  console.log('\n🎯 Use Cases Enhanced:');
  console.log('   • SIEM rule testing for both detection AND response');
  console.log('   • Complete incident response training scenarios');
  console.log('   • Security tool effectiveness validation');
  console.log('   • Compliance audit trail simulation');
  console.log('   • Threat hunting exercise data');

  console.log('\n🏆 Integration Complete!');
  console.log('   Your log generator now supports both offensive (ATT&CK) and');
  console.log('   defensive (D3FEND) cybersecurity frameworks for comprehensive');
  console.log('   security training and SIEM testing scenarios.');
}

// Run the demo
demonstrateD3FENDIntegration().catch(console.error);

module.exports = { demonstrateD3FENDIntegration };

