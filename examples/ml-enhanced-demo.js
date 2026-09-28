#!/usr/bin/env node

/**
 * ML Pattern Demonstration
 *
 * Walks through the Node-only ML pipeline on real logs (logs/historical) or, when there are
 * none, a small built-in sample: learn a profile, generate logs from it, analyze patterns,
 * find unusual logs, forecast volume, extract indicators and train a text classifier.
 *
 * Run `npm run build` first; this example uses the compiled code in dist/.
 */

const fs = require('fs');
const { readLogFiles } = require('../dist/utils/logFiles');
const { buildProfile, generateFromProfile } = require('../dist/ml/logProfile');
const { analyzeLogs } = require('../dist/ml/logAnalysis');
const { bucketByWindow, forecastAuto } = require('../dist/ml/volumeAnalysis');
const { extractIndicators } = require('../dist/ml/indicators');
const { trainTextClassifier } = require('../dist/ml/logTextClassifier');

function sampleLogs() {
  const logs = [];
  const start = Date.parse('2026-01-05T00:00:00.000Z');
  for (let i = 0; i < 600; i++) {
    const hour = 8 + (i % 10);
    const timestamp = new Date(start + hour * 3600000 + (i % 60) * 60000).toISOString();
    if (i % 3 === 0) {
      logs.push({ timestamp, level: i % 30 === 0 ? 'ERROR' : 'WARN', source: { type: 'authentication', name: 'auth-service' }, message: `Failed login for user${i % 25} from 203.0.113.${i % 250}`, metadata: { user: `user${i % 25}` } });
    } else {
      logs.push({ timestamp, level: 'INFO', source: { type: 'webserver', name: 'nginx' }, message: `GET /api/items/${i} 200 ${20 + (i % 80)}ms`, metadata: {} });
    }
  }
  return logs;
}

async function loadLogs() {
  const dir = 'logs/historical';
  if (fs.existsSync(dir)) {
    const { logs, files } = await readLogFiles([dir]);
    if (logs.length >= 100) {
      console.log(`📁 Using ${logs.length} logs from ${files.length} file(s) in ${dir}\n`);
      return logs;
    }
  }
  console.log('📁 No logs in logs/historical; using a built-in sample of 600 logs\n');
  return sampleLogs();
}

async function demonstrate() {
  console.log('🧠 ML Pattern Demonstration (Node only, no Python needed)\n');
  const logs = await loadLogs();

  // 1. Learn a profile and generate new logs that follow it
  const profile = buildProfile(logs);
  const [source] = Object.entries(profile.sources).sort(([, a], [, b]) => b.count - a.count)[0];
  console.log(`1️⃣  Learned ${Object.keys(profile.sources).length} source(s); generating 3 logs for "${source}":`);
  generateFromProfile(profile, source, { count: 3, seed: 1 }).forEach(log => console.log(`    [${log.level}] ${log.message}`));

  // 2. Message patterns and unusual logs
  const report = analyzeLogs(logs, { top: 3 });
  console.log('\n2️⃣  Top message patterns:');
  report.templates.forEach(t => console.log(`    ${String(t.count).padStart(5)}  ${t.template.slice(0, 90)}`));
  if (report.outliers.length > 0) {
    console.log(`    Most unusual log (score ${report.outliers[0].score.toFixed(2)}): ${report.outliers[0].message.slice(0, 90)}`);
  }

  // 3. Volume forecast (seasonal or linear, whichever fits the history better)
  const buckets = bucketByWindow(logs, 3600000);
  if (buckets.length >= 2) {
    const forecast = forecastAuto(buckets, 3, 3600000);
    console.log(`\n3️⃣  Forecast (${forecast.method}): next hours ~${forecast.forecast.map(p => p.count).join(', ')} logs`);
  }

  // 4. Indicators
  const indicators = extractIndicators(logs);
  console.log(`\n4️⃣  Indicators found: ${indicators.length} (top: ${indicators.slice(0, 3).map(i => `${i.type} ${i.value}`).join(', ') || 'none'})`);

  // 5. Text classifier: predict the source from the message
  try {
    const result = trainTextClassifier(logs, 'source');
    console.log(`\n5️⃣  Source classifier accuracy: ${(result.accuracy * 100).toFixed(1)}% (baseline ${(result.baselineAccuracy * 100).toFixed(1)}%)`);
  } catch (error) {
    console.log(`\n5️⃣  Source classifier skipped: ${error.message}`);
  }

  console.log('\nThe same features as commands:');
  console.log('   npm run ml-patterns:learn logs/historical/ && npm run ml-patterns:generate <source> -- --count 20');
  console.log('   npm run ml-patterns:analyze | ml-patterns:test-anomaly | ml-patterns:forecast | ml-patterns:threat-intel | ml-patterns:train-nlp');
}

if (require.main === module) {
  demonstrate().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { demonstrate };
