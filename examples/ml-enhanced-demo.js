#!/usr/bin/env node

/**
 * ML-Enhanced Log Generator Demo
 * Demonstrates the new ML capabilities added to the log generator
 */

const { LogGeneratorManager } = require('../dist/LogGeneratorManager');
const { MLModelManager } = require('../dist/ml/MLModelManager');
const { NLPEnhancedGenerator } = require('../dist/ml/NLPEnhancedGenerator');
const { PythonMLBridge } = require('../dist/ml/PythonMLBridge');
const fs = require('fs');
const path = require('path');

// Enhanced ML Configuration
const mlConfig = {
  learning: {
    enabled: true,
    learningRate: 0.01,
    adaptationPeriod: 24,
    minSampleSize: 100,
    maxHistoryDays: 7
  },
  
  nlp: {
    enabled: true,
    models: {
      textGeneration: "distilbert-base-uncased",
      semanticAnalysis: "sentence-transformers/all-MiniLM-L6-v2",
      classification: "distilbert-base-uncased-finetuned-sst-2-english",
      sentiment: "cardiffnlp/twitter-roberta-base-sentiment-latest"
    },
    cacheEnabled: true,
    cacheTTL: 3600
  },
  
  anomalyDetection: {
    models: {
      isolationForest: true,
      oneClassSVM: true,
      autoEncoder: false,
      statisticalOutlier: true
    },
    thresholds: {
      anomalyScore: 0.7,
      confidenceLevel: 0.8,
      statisticalThreshold: 2.5
    },
    ensembleWeights: {
      isolationForest: 0.4,
      oneClassSVM: 0.3,
      autoEncoder: 0.2,
      statistical: 0.1
    }
  },
  
  timeSeriesForecasting: {
    enabled: true,
    models: {
      prophet: true,
      lstm: false,
      arima: true,
      seasonalDecompose: true
    },
    forecastHorizon: 24,
    seasonalityPeriods: {
      daily: true,
      weekly: true,
      monthly: false,
      yearly: false
    }
  },
  
  threatIntelligence: {
    enabled: true,
    sources: ["internal_analysis", "pattern_matching"],
    updateInterval: 6,
    models: {
      iocDetection: true,
      behavioralAnalysis: true,
      mitreMapping: true,
      riskScoring: true
    },
    confidence: {
      minThreshold: 0.6,
      highThreshold: 0.8
    }
  },
  
  performance: {
    modelCaching: true,
    parallelProcessing: true,
    batchSize: 50,
    maxMemoryUsage: 1024,
    gpuAcceleration: false
  }
};

async function demonstrateMLCapabilities() {
  console.log('🧠 ML-Enhanced Log Generator Demo');
  console.log('=====================================\n');

  try {
    // Initialize ML components
    console.log('1. Initializing ML Components...');
    const modelManager = new MLModelManager(mlConfig);
    const pythonBridge = new PythonMLBridge({
      pythonPath: 'python3',
      timeout: 30000
    });

    // Check Python environment
    console.log('2. Checking Python ML Environment...');
    const pythonEnv = await pythonBridge.checkPythonEnvironment();
    console.log(`   Python Available: ${pythonEnv.available}`);
    console.log(`   Libraries: ${pythonEnv.libraries.join(', ')}`);
    console.log();

    // Create sample log sources
    const sources = [
      {
        name: 'ml-enhanced-auth',
        type: 'authentication',
        format: 'json',
        frequency: 30
      },
      {
        name: 'ml-enhanced-app',
        type: 'application',
        format: 'json',
        frequency: 45
      },
      {
        name: 'ml-enhanced-firewall',
        type: 'firewall',
        format: 'json',
        frequency: 60
      }
    ];

    // Generate ML-enhanced logs
    console.log('3. Generating ML-Enhanced Logs...');
    const generatedLogs = [];

    for (const source of sources) {
      console.log(`   Generating logs for ${source.name}...`);
      const generator = new NLPEnhancedGenerator(source, modelManager, mlConfig);
      
      for (let i = 0; i < 10; i++) {
        try {
          const logEntry = await generator.generateLogEntry();
          generatedLogs.push(logEntry);
          
          // Show sample log
          if (i === 0) {
            console.log(`   Sample log: ${logEntry.message.substring(0, 80)}...`);
          }
        } catch (error) {
          console.log(`   Fallback generation for ${source.name}: ${error.message}`);
          // Generate basic log as fallback
          const basicLog = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            source: source,
            message: `ML-enhanced ${source.type} event generated with fallback`,
            metadata: {
              ml_enhanced: false,
              fallback_reason: error.message
            }
          };
          generatedLogs.push(basicLog);
        }
      }
    }

    console.log(`   Generated ${generatedLogs.length} ML-enhanced logs\n`);

    // Demonstrate NLP Analysis
    console.log('4. Performing NLP Analysis...');
    try {
      const sampleLogs = generatedLogs.slice(0, 5);
      const nlpResults = await modelManager.analyzeText(sampleLogs[0].message);
      
      console.log(`   Sample NLP Analysis:`);
      console.log(`   - Sentiment: ${nlpResults.sentiment.label} (${nlpResults.confidence.toFixed(2)})`);
      console.log(`   - Keywords: ${nlpResults.keywords.slice(0, 3).join(', ')}`);
      console.log(`   - Readability: ${nlpResults.readability.toFixed(1)}`);
      console.log();
    } catch (error) {
      console.log(`   NLP Analysis (fallback): Using basic text analysis`);
      console.log(`   - Reason: ${error.message}`);
      console.log();
    }

    // Demonstrate Anomaly Detection
    console.log('5. Performing Anomaly Detection...');
    try {
      const sampleLogs = generatedLogs.slice(0, 10);
      
      // Try Python-based anomaly detection first
      if (pythonEnv.available && pythonEnv.libraries.includes('sklearn')) {
        const anomalies = await pythonBridge.predictAnomalies(sampleLogs);
        const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
        console.log(`   Python ML Anomaly Detection: ${anomalyCount}/${sampleLogs.length} anomalies detected`);
        
        if (anomalyCount > 0) {
          const firstAnomaly = anomalies.find(a => a.isAnomaly);
          console.log(`   - Sample anomaly: ${firstAnomaly.explanation}`);
        }
      } else {
        // Fallback to built-in anomaly detection
        const anomalyResult = await modelManager.detectAnomaly(sampleLogs[0]);
        console.log(`   Built-in Anomaly Detection: ${anomalyResult.isAnomaly ? 'Anomaly' : 'Normal'}`);
        console.log(`   - Score: ${anomalyResult.anomalyScore.toFixed(3)}`);
        console.log(`   - Confidence: ${anomalyResult.confidence.toFixed(3)}`);
      }
      console.log();
    } catch (error) {
      console.log(`   Anomaly Detection (fallback): Basic statistical analysis`);
      console.log(`   - Reason: ${error.message}`);
      console.log();
    }

    // Demonstrate Time Series Forecasting
    console.log('6. Performing Time Series Forecasting...');
    try {
      if (pythonEnv.available && pythonEnv.libraries.includes('prophet')) {
        const forecasts = await pythonBridge.generateForecast(generatedLogs, 6);
        console.log(`   Prophet Forecasting: Generated ${forecasts.length} forecast points`);
        
        if (forecasts.length > 0) {
          const firstForecast = forecasts[0];
          console.log(`   - Next hour prediction: ${firstForecast.predicted.toFixed(1)} logs`);
          console.log(`   - Trend: ${firstForecast.trend}`);
        }
      } else {
        console.log(`   Time Series Forecasting: Basic trend analysis`);
        const trend = generatedLogs.length > 10 ? 'stable' : 'increasing';
        console.log(`   - Detected trend: ${trend}`);
      }
      console.log();
    } catch (error) {
      console.log(`   Time Series Forecasting (fallback): Simple trend analysis`);
      console.log(`   - Reason: ${error.message}`);
      console.log();
    }

    // Demonstrate Threat Intelligence
    console.log('7. Performing Threat Intelligence Analysis...');
    try {
      const threatResults = await pythonBridge.analyzeThreatIntelligence(generatedLogs);
      console.log(`   Threat Intelligence: ${threatResults.length} potential threats identified`);
      
      if (threatResults.length > 0) {
        const firstThreat = threatResults[0];
        console.log(`   - IOC: ${firstThreat.ioc} (${firstThreat.type})`);
        console.log(`   - Risk Score: ${firstThreat.riskScore.toFixed(2)}`);
      } else {
        console.log(`   - No threats detected in generated logs`);
      }
      console.log();
    } catch (error) {
      console.log(`   Threat Intelligence (fallback): Basic pattern matching`);
      console.log(`   - Reason: ${error.message}`);
      console.log();
    }

    // Save results
    console.log('8. Saving Results...');
    const outputDir = path.join(__dirname, '../logs/ml-demo');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `ml-demo-${Date.now()}.json`);
    const results = {
      timestamp: new Date().toISOString(),
      config: mlConfig,
      pythonEnvironment: pythonEnv,
      generatedLogs: generatedLogs,
      summary: {
        totalLogs: generatedLogs.length,
        mlEnhanced: generatedLogs.filter(log => log.metadata?.ml_enhanced !== false).length,
        sources: sources.length
      }
    };

    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`   Results saved to: ${outputFile}`);
    console.log();

    // Performance Summary
    console.log('9. Performance Summary:');
    const mlEnhancedCount = generatedLogs.filter(log => log.metadata?.ml_enhanced !== false).length;
    const fallbackCount = generatedLogs.length - mlEnhancedCount;
    
    console.log(`   ✅ ML-Enhanced Logs: ${mlEnhancedCount}/${generatedLogs.length}`);
    console.log(`   ⚠️  Fallback Logs: ${fallbackCount}/${generatedLogs.length}`);
    console.log(`   🧠 NLP Analysis: ${mlConfig.nlp.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   🚨 Anomaly Detection: ${mlConfig.anomalyDetection.models.isolationForest ? 'Enabled' : 'Disabled'}`);
    console.log(`   📈 Time Series: ${mlConfig.timeSeriesForecasting.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   🔍 Threat Intel: ${mlConfig.threatIntelligence.enabled ? 'Enabled' : 'Disabled'}`);
    console.log();

    console.log('🎉 ML-Enhanced Log Generator Demo Completed Successfully!');
    console.log('\nNext Steps:');
    console.log('- Install Python dependencies: pip install -r requirements.txt');
    console.log('- Configure ML settings in config/ml-enhanced.yaml');
    console.log('- Run: npm run generate -- --ml-enhanced --count 1000');
    console.log('- Monitor: npm run ml-patterns:status');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure all dependencies are installed: npm install');
    console.log('2. Install Python dependencies: pip install -r requirements.txt');
    console.log('3. Check Python path in configuration');
    console.log('4. Verify disk space and memory availability');
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  demonstrateMLCapabilities().catch(console.error);
}

module.exports = { demonstrateMLCapabilities, mlConfig };

