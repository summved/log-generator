# 🧠 ML Enhancement Installation & Usage Guide

## 📋 Prerequisites

### System Requirements
- **Node.js**: >= 18.0.0
- **Python**: >= 3.8.0
- **Memory**: >= 4GB RAM (8GB+ recommended for large models)
- **Storage**: >= 2GB free space for models
- **Optional**: CUDA-compatible GPU for accelerated inference

### Operating System Support
- ✅ Linux (Ubuntu 20.04+, CentOS 8+)
- ✅ macOS (10.15+)
- ✅ Windows 10/11 (with WSL2 recommended)

---

## 🚀 Installation Steps

### Step 1: Install Node.js Dependencies

```bash
# Navigate to project directory
cd log-generator

# Install enhanced dependencies
npm install

# Verify installation
npm run status
```

**New ML Dependencies Added:**
- `@xenova/transformers` - Hugging Face Transformers for Node.js
- `natural` - Natural Language Processing
- `ml-isolation-forest` - Anomaly detection
- `python-shell` - Python integration
- `sentiment` - Sentiment analysis
- `simple-statistics` - Statistical computations

### Step 2: Install Python Dependencies

```bash
# Install Python ML libraries
pip install -r requirements.txt

# Or install with conda
conda env create -f environment.yml
conda activate log-generator-ml

# Verify Python installation
python python/ml_models.py --version
```

**Python Libraries Installed:**
- `scikit-learn` - Machine learning algorithms
- `pandas` - Data manipulation
- `transformers` - Hugging Face models
- `prophet` - Time series forecasting
- `torch` - PyTorch for deep learning
- `spacy` - Advanced NLP

### Step 3: Download Pre-trained Models (Optional)

```bash
# Download recommended models
python -c "
from transformers import pipeline
pipeline('sentiment-analysis', model='distilbert-base-uncased-finetuned-sst-2-english')
print('Models downloaded successfully!')
"

# Download spaCy language model
python -m spacy download en_core_web_sm
```

### Step 4: Configuration Setup

Create enhanced ML configuration:

```bash
# Copy example configuration
cp config/ml-enhanced.example.yaml config/ml-enhanced.yaml

# Edit configuration
nano config/ml-enhanced.yaml
```

**Example Configuration:**
```yaml
ml:
  enabled: true
  
  nlp:
    enabled: true
    models:
      textGeneration: "distilbert-base-uncased"
      semanticAnalysis: "sentence-transformers/all-MiniLM-L6-v2"
      classification: "distilbert-base-uncased-finetuned-sst-2-english"
      sentiment: "cardiffnlp/twitter-roberta-base-sentiment-latest"
    cacheEnabled: true
    cacheTTL: 3600
  
  anomalyDetection:
    models:
      isolationForest: true
      oneClassSVM: true
      autoEncoder: false
      statisticalOutlier: true
    thresholds:
      anomalyScore: 0.7
      confidenceLevel: 0.8
      statisticalThreshold: 2.5
    ensembleWeights:
      isolationForest: 0.4
      oneClassSVM: 0.3
      autoEncoder: 0.2
      statistical: 0.1
  
  timeSeriesForecasting:
    enabled: true
    models:
      prophet: true
      lstm: false
      arima: true
      seasonalDecompose: true
    forecastHorizon: 24
    seasonalityPeriods:
      daily: true
      weekly: true
      monthly: false
      yearly: false
  
  threatIntelligence:
    enabled: true
    sources: ["internal_analysis", "pattern_matching"]
    updateInterval: 6
    models:
      iocDetection: true
      behavioralAnalysis: true
      mitreMapping: true
      riskScoring: true
    confidence:
      minThreshold: 0.6
      highThreshold: 0.8
  
  performance:
    modelCaching: true
    parallelProcessing: true
    batchSize: 100
    maxMemoryUsage: 2048
    gpuAcceleration: false
```

---

## 🎯 Usage Examples

### Basic ML-Enhanced Log Generation

```bash
# Generate logs with ML enhancement
npm run generate -- --ml-enhanced --count 1000 --output file

# Generate with specific ML features
npm run generate -- --ml-enhanced --nlp-enabled --anomaly-rate 0.1

# Generate with time series patterns
npm run generate -- --ml-enhanced --forecast-enabled --hours 24
```

### Advanced ML Commands

```bash
# Train NLP models on historical data
npm run ml-patterns:train-nlp -- --data logs/historical/

# Test anomaly detection
npm run ml-patterns:test-anomaly -- --threshold 0.8 --input logs/current/

# Generate forecasts
npm run ml-patterns:forecast -- --horizon 48h --confidence 0.9

# Analyze threat intelligence
npm run ml-patterns:threat-intel -- --input logs/security/
```

### Python ML Analysis

```bash
# Direct Python model usage
echo '{"log_entries": [...]}' | python python/ml_models.py anomaly_train

# Batch analysis
python python/ml_models.py nlp_analyze < logs/sample.json

# Threat intelligence extraction
python python/ml_models.py threat_intel < logs/security.json
```

### Programmatic Usage

```typescript
import { MLModelManager } from './src/ml/MLModelManager';
import { NLPEnhancedGenerator } from './src/ml/NLPEnhancedGenerator';
import { PythonMLBridge } from './src/ml/PythonMLBridge';

// Initialize ML components
const mlConfig = { /* your config */ };
const modelManager = new MLModelManager(mlConfig);
const pythonBridge = new PythonMLBridge();

// Generate ML-enhanced logs
const generator = new NLPEnhancedGenerator(source, modelManager, mlConfig);
const logEntry = await generator.generateLogEntry();

// Analyze with Python models
const anomalies = await pythonBridge.predictAnomalies([logEntry]);
const nlpResults = await pythonBridge.analyzeWithNLP([logEntry]);
const threats = await pythonBridge.analyzeThreatIntelligence([logEntry]);
```

---

## 🔧 Configuration Options

### ML Model Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ml.enabled` | boolean | `true` | Enable/disable ML features |
| `nlp.enabled` | boolean | `true` | Enable NLP processing |
| `anomalyDetection.models.isolationForest` | boolean | `true` | Use Isolation Forest |
| `timeSeriesForecasting.forecastHorizon` | number | `24` | Hours to forecast ahead |
| `threatIntelligence.confidence.minThreshold` | number | `0.6` | Minimum confidence for threats |

### Performance Tuning

```yaml
performance:
  # Model caching reduces load times
  modelCaching: true
  
  # Process multiple requests in parallel
  parallelProcessing: true
  
  # Batch size for bulk operations
  batchSize: 100
  
  # Memory limit in MB
  maxMemoryUsage: 2048
  
  # Enable GPU acceleration (requires CUDA)
  gpuAcceleration: false
```

### Python Integration

```yaml
python:
  pythonPath: "python3"
  scriptPath: "./python/ml_models.py"
  timeout: 30000  # 30 seconds
  maxMemory: 2048  # 2GB
  enableGPU: false
```

---

## 📊 Monitoring & Metrics

### Built-in Metrics

The ML-enhanced log generator provides comprehensive metrics:

```bash
# View ML performance metrics
npm run ml-patterns:status

# Check model performance
curl http://localhost:3000/api/ml/metrics

# Monitor resource usage
npm run performance-test -- --ml-enabled
```

### Grafana Dashboard

Enhanced Grafana dashboards include ML metrics:

```bash
# Start monitoring stack with ML metrics
docker-compose -f docker-compose.yml -f docker-compose.ml.yml up -d

# Access Grafana
open http://localhost:3001
```

**ML Metrics Available:**
- Model inference times
- Anomaly detection rates
- NLP processing throughput
- Memory usage by model
- GPU utilization (if enabled)
- Prediction accuracy scores

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Python Dependencies Not Found
```bash
# Error: ModuleNotFoundError: No module named 'transformers'
pip install -r requirements.txt

# Or create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

#### 2. Out of Memory Errors
```yaml
# Reduce batch size and memory usage
performance:
  batchSize: 50
  maxMemoryUsage: 1024
  
# Disable memory-intensive models
anomalyDetection:
  models:
    autoEncoder: false
```

#### 3. Slow Model Loading
```bash
# Pre-download models
python -c "
from transformers import pipeline
pipeline('sentiment-analysis')
"

# Enable model caching
performance:
  modelCaching: true
```

#### 4. GPU Not Detected
```bash
# Check CUDA installation
nvidia-smi

# Install PyTorch with CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Enable GPU in config
performance:
  gpuAcceleration: true
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=log-generator:ml

# Run with verbose output
npm run generate -- --ml-enhanced --verbose --debug

# Check Python model status
python python/ml_models.py --check-environment
```

### Performance Optimization

```bash
# Profile ML performance
npm run performance-test -- --ml-enabled --profile

# Optimize for memory usage
npm run generate -- --ml-enhanced --memory-optimized

# Use lightweight models
npm run generate -- --ml-enhanced --lightweight-models
```

---

## 🔒 Security Considerations

### Model Security

1. **Model Integrity**: Verify model checksums
2. **Input Validation**: Sanitize all inputs to ML models
3. **Resource Limits**: Set memory and CPU limits
4. **Access Control**: Restrict access to ML endpoints

### Privacy

1. **Data Anonymization**: Remove PII before ML processing
2. **Local Processing**: Keep sensitive data on-premises
3. **Model Encryption**: Encrypt model files at rest

### Best Practices

```typescript
// Validate inputs before ML processing
const sanitizedInput = validateAndSanitize(userInput);

// Set resource limits
const mlConfig = {
  performance: {
    maxMemoryUsage: 1024,
    timeout: 30000
  }
};

// Use secure model loading
const modelManager = new MLModelManager(mlConfig, {
  verifyChecksum: true,
  encryptionKey: process.env.MODEL_ENCRYPTION_KEY
});
```

---

## 📚 Additional Resources

### Documentation
- [ML Enhancement Plan](./ML_ENHANCEMENT_PLAN.md)
- [API Documentation](./docs/ML_API.md)
- [Model Training Guide](./docs/ML_TRAINING.md)

### Example Projects
- [Basic ML Integration](./examples/ml-basic.js)
- [Advanced Anomaly Detection](./examples/ml-anomaly.js)
- [NLP Log Analysis](./examples/ml-nlp.js)

### Community
- [GitHub Issues](https://github.com/your-org/log-generator/issues)
- [Discord Community](https://discord.gg/log-generator)
- [Documentation Wiki](https://github.com/your-org/log-generator/wiki)

---

## 🎉 Success! 

Your log generator now has advanced ML capabilities including:

✅ **NLP-Enhanced Message Generation**  
✅ **Multi-Model Anomaly Detection**  
✅ **Time Series Forecasting**  
✅ **Threat Intelligence Analysis**  
✅ **Python ML Integration**  
✅ **Performance Monitoring**  

Start generating intelligent, realistic logs with:

```bash
npm run generate -- --ml-enhanced --count 1000
```

For support, check our [troubleshooting guide](#-troubleshooting) or [open an issue](https://github.com/your-org/log-generator/issues).

