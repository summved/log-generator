# 🚀 Advanced Features Guide

This document covers the advanced features and detailed usage of the Log Generator, including the latest high-performance worker threads and SIEM integration capabilities.

## 📋 Table of Contents

- [🎯 MITRE ATT&CK Integration](#-mitre-attck-integration)
- [🛡️ D3FEND Defensive Framework](#️-d3fend-defensive-framework)
- [🔗 Attack Chain Simulation](#-attack-chain-simulation)
- [🤖 AI-Enhanced Attack Chains](#-ai-enhanced-attack-chains)
- [🧠 ML-Based Pattern Learning](#-ml-based-pattern-learning)
- [⚡ High-Performance Worker Threads](#-high-performance-worker-threads)
- [🌐 SIEM Integration & Network Output](#-siem-integration--network-output)
- [🔄 Advanced Replay Features](#-advanced-replay-features)
- [📊 Performance Testing & Optimization](#-performance-testing--optimization)
- [🛡️ Security Operations Center (SOC) Simulation](#️-security-operations-center-soc-simulation)
- [📈 Real-time Monitoring & Metrics](#-real-time-monitoring--metrics)
- [🐳 Docker & Kubernetes Deployment](#-docker--kubernetes-deployment)
- [⚙️ Configuration Validation](#️-configuration-validation)

## 🎯 MITRE ATT&CK Integration

### Supported Techniques & Tactics

The log generator supports **14 MITRE ATT&CK techniques** across **12 tactics**:

#### **Initial Access (TA0001)**
- **T1078** - Valid Accounts: Login from unusual geographic locations
- **T1190** - Exploit Public-Facing Application: Web application attacks

#### **Execution (TA0002)**
- **T1059** - Command and Scripting Interpreter: PowerShell, Bash execution

#### **Persistence (TA0003)**
- **T1098** - Account Manipulation: Unauthorized account modifications

#### **Privilege Escalation (TA0004)**
- **T1068** - Exploitation for Privilege Escalation: Privilege escalation attempts

#### **Defense Evasion (TA0005)**
- **T1562.001** - Disable or Modify Tools: Security tool tampering
- **T1562.004** - Disable or Modify System Firewall: Firewall rule changes

#### **Credential Access (TA0006)**
- **T1110** - Brute Force: Password attack attempts
- **T1110.001** - Password Guessing: Systematic password guessing

#### **Discovery (TA0007)**
- **T1018** - Remote System Discovery: Network reconnaissance
- **T1082** - System Information Discovery: System enumeration

#### **Collection (TA0009)**
- **T1005** - Data from Local System: Local file access
- **T1213** - Data from Information Repositories: Database queries

#### **Exfiltration (TA0010)**
- **T1041** - Exfiltration Over C2 Channel: Data exfiltration

### Usage Examples

```bash
# Generate brute force attack logs
npm run generate -- --mitre-technique T1110.001 --duration 1h

# Generate logs for credential access tactic
npm run generate -- --mitre-tactic TA0006 --duration 30m

# List all supported techniques
npm run mitre-list --techniques

# Analyze MITRE coverage in historical logs
npm run mitre-coverage logs/historical/
```

## 🛡️ D3FEND Defensive Framework

### Supported Categories & Techniques

The log generator integrates with the MITRE D3FEND framework to generate realistic defensive response logs:

#### **Detect (D3-D)**
- **D3-NTA** - Network Traffic Analysis
- **D3-FA** - File Analysis  
- **D3-AM** - Authentication Monitoring
- **D3-LA** - Log Analysis

#### **Deny (D3-DN)**
- **D3-ACL** - Access Control Lists
- **D3-NB** - Network Blocking
- **D3-WAF** - Web Application Firewall

#### **Contain (D3-C)**
- **D3-NI** - Network Isolation
- **D3-AL** - Account Lockout
- **D3-PT** - Process Termination

#### **Deceive (D3-DC)**
- **D3-DF** - Decoy Files
- **D3-HN** - Honeypots

#### **Disrupt (D3-DR)**
- **D3-CR** - Credential Rotation
- **D3-DNS** - DNS Sinkhole

### Usage Examples

```bash
# Generate defensive logs for detection category
npm run generate -- --d3fend-category Detect --duration 30m

# Generate logs for specific defensive technique
npm run generate -- --d3fend-technique D3-NTA --count 100

# List all D3FEND techniques
npm run d3fend-list

# Check D3FEND coverage
npm run d3fend-coverage logs/historical/
```

## 🔗 Attack Chain Simulation

Execute realistic multi-stage attack scenarios with correlated defensive responses:

### Available Attack Chains

#### **🐻 APT29 Cozy Bear** (45 minutes, 10 stages)
Advanced nation-state attack simulation with sophisticated techniques:
1. Initial reconnaissance and target identification
2. Spear-phishing email campaign
3. Malware deployment and persistence
4. Credential harvesting and lateral movement
5. Data collection and exfiltration

#### **💀 Ryuk Ransomware** (30 minutes, 11 stages)
Enterprise ransomware campaign simulation:
1. Initial access via RDP brute force
2. Reconnaissance and network mapping
3. Privilege escalation and persistence
4. Defense evasion and tool deployment
5. File encryption and ransom demand

#### **🕵️ Malicious Insider** (25 minutes, 11 stages)
Data theft scenario by insider threat:
1. Legitimate access with suspicious behavior
2. Data discovery and collection
3. Unauthorized access attempts
4. Data exfiltration preparation
5. Cover-up and evidence deletion

### Usage Examples

```bash
# List available attack chains
npm run attack-chains:list

# Get detailed information about a specific chain
npm run attack-chains:info apt29-cozy-bear

# Execute attack chain with custom speed
npm run attack-chains:execute apt29-cozy-bear --speed 2.0

# Monitor execution status
npm run attack-chains:status

# Abort running execution
npm run attack-chains:abort <execution-id>

# Check MITRE coverage across all chains
npm run attack-chains:coverage
```

## 🤖 AI-Enhanced Attack Chains

Transform static attack chains into intelligent, adaptive adversary simulations with **local AI** - no external APIs, tokens, or dependencies required.

### 🎯 Enhancement Modes

#### **Static Mode** (Original Behavior)
- Executes original attack chains unchanged
- 100% backward compatible
- Predictable timing and techniques

#### **Enhanced Mode** (Rule-Based AI)
- Local MITRE knowledge base
- Technique substitution (Mimikatz → SAM registry)
- Timing randomization and log variation
- Evasion tactics integration

#### **Dynamic Mode** (Full AI)
- AI-generated scenario variations
- Adaptive adversary behavior
- Novel attack technique combinations
- Realistic business context awareness

### 🎛️ AI Enhancement Levels

| Level | Features | Example Enhancements |
|-------|----------|---------------------|
| **Basic** | Timing randomization, log noise | Ryuk encryption: 15min → 12-18min variance |
| **Medium** | + Technique substitution | Mimikatz → SAM registry extraction |
| **High** | + Evasion tactics | PowerShell → WMI execution |
| **Advanced** | + Anti-forensics, adaptive behavior | Memory-only execution, log evasion |

### 🚀 Usage Examples

#### **Execute AI-Enhanced Chain**
```bash
# Basic AI enhancement
npm run attack-chains:execute-ai ransomware-ryuk --mode enhanced --ai-level basic

# Advanced AI with evasion tactics
npm run attack-chains:execute-ai apt29-cozy-bear --mode dynamic --ai-level high --enable-evasion

# Multiple variations for training
npm run attack-chains:execute-ai insider-threat --mode enhanced --variations 3
```

#### **Progressive Training Sessions**
```bash
# Run 5 variations with progressive difficulty
npm run attack-chains:training ransomware-ryuk --variations 5 --progressive

# Custom training with delays between variations
npm run attack-chains:training apt29-cozy-bear --variations 10 --delay 60000
```

#### **Preview Enhancements**
```bash
# Preview changes without execution
npm run attack-chains:preview ransomware-ryuk --mode enhanced --ai-level medium

# Show available AI options for a chain
npm run attack-chains:ai-options apt29-cozy-bear

# View execution statistics
npm run attack-chains:ai-statistics --limit 100
```

### 🔄 How AI Transforms Your Chains

#### **Before (Static Ryuk):**
```yaml
- name: "Credential Harvesting with Mimikatz"
  mitre:
    technique: "T1003.001"  # Always Mimikatz
  timing:
    duration: 120000        # Always 2 minutes
  logGeneration:
    frequency: 20           # Always 20 logs
```

#### **After (AI Enhanced):**
```yaml
# Execution 1: Enhanced Mode
- name: "Credential Harvesting with Registry Access"
  mitre:
    technique: "T1003.002"  # AI substituted SAM access
  timing:
    duration: 156000        # AI randomized: 2.6 minutes
  logGeneration:
    frequency: 17           # AI varied: 17 logs
    customData:
      evasion_tactic: "Living off the Land"
      ai_enhanced: true

# Execution 2: Different AI Enhancement
- name: "Credential Harvesting with WMI"
  mitre:
    technique: "T1047"       # AI chose WMI alternative
  timing:
    duration: 98000          # AI randomized: 1.6 minutes
  logGeneration:
    frequency: 23            # AI varied: 23 logs
    customData:
      evasion_tactic: "Timing Evasion"
      detection_difficulty: "High"
```

### 🧠 Built-in AI Knowledge Base

#### **MITRE ATT&CK Intelligence:**
- **Technique Substitutions**: T1003.001 (Mimikatz) ↔ T1003.002 (SAM) ↔ T1047 (WMI)
- **Equivalent Goals**: Same objective, different methods
- **Difficulty Ratings**: 1-10 scale for technique complexity
- **Detectability Scores**: 1-10 scale for detection difficulty

#### **Evasion Tactics Database:**
- **Living off the Land**: Use legitimate system tools
- **Timing Evasion**: Execute during low-monitoring periods
- **Anti-Forensics**: Memory-only execution, log evasion
- **Obfuscation**: Avoid suspicious patterns and signatures

### 📊 Training Value Multiplication

#### **Before AI Enhancement:**
- Same attack gets boring after 3-5 runs
- SOC teams memorize static patterns
- Limited training scenarios

#### **After AI Enhancement:**
- **Infinite Variations**: Never the same attack twice
- **Progressive Difficulty**: Scales from beginner to expert
- **Continuous Learning**: SOC teams must constantly adapt
- **Real-world Preparation**: Mimics actual adversary evolution

### 🎯 Revolutionary Benefits

✅ **100% Local** - No tokens, APIs, or external dependencies  
✅ **Backward Compatible** - All existing functionality unchanged  
✅ **Infinite Variations** - Never-ending training value  
✅ **Progressive Difficulty** - Scales from beginner to expert  
✅ **Realistic Adversary** - Mimics real-world attack evolution  
✅ **Zero Cost** - No API fees or subscription costs

## 🧠 ML-Based Pattern Learning

### Pattern Learning Engine

The ML engine learns from historical log data to generate realistic, behavior-based logs:

#### **Supported Pattern Types**
- **User Behavior Patterns** - Login times, application usage, error rates
- **System Performance Patterns** - CPU, memory, network usage trends
- **Security Event Patterns** - Attack patterns and threat indicators
- **Temporal Patterns** - Time-based activity correlations

#### **Anomaly Generation**
- **Configurable Anomaly Rate** - 1-50% anomaly injection
- **Severity Levels** - Low, Medium, High, Critical anomalies
- **Realistic Deviations** - Statistically accurate anomalies

### Usage Examples

```bash
# Learn patterns from historical data
npm run ml-patterns:learn logs/historical/*.jsonl --min-samples 1000

# Generate ML-enhanced logs with anomalies
npm run ml-patterns:generate authentication --count 500 --anomaly-rate 0.15

# Check ML engine status and statistics
npm run ml-patterns:status

# Analyze patterns in existing files
npm run ml-patterns:analyze logs/current/*.jsonl

# Configure ML parameters
npm run ml-patterns:config --learning-rate 0.01 --max-history-days 30

# Reset learned patterns
npm run ml-patterns:reset
```

## ⚡ High-Performance Worker Threads

### Worker Thread Architecture

The log generator now supports parallel processing using Node.js worker threads for maximum performance:

#### **Key Features**
- **Multi-Core Processing** - Utilizes all available CPU cores
- **Memory-First Approach** - 10,000 log buffer before disk writes
- **Parallel Generation** - Simultaneous log creation across workers
- **Load Balancing** - Automatic work distribution across threads

#### **Performance Benefits**
- **5-10x Performance Improvement** - Compared to single-threaded generation
- **Scalable Architecture** - Performance scales with CPU cores
- **Reduced I/O Blocking** - Memory buffering prevents disk bottlenecks
- **SIEM Compatibility** - Maintains JSON format for all integrations

### Usage Examples

```bash
# Enable high-performance mode with 4 workers
npm run performance-test -- --mode worker --workers 4 --duration 30s

# Test different worker configurations
npm run performance-test -- --mode worker --workers 8 --duration 1m

# Compare performance modes
npm run performance-test -- --mode disk --duration 10s
npm run performance-test -- --mode worker --duration 10s
```

### Configuration

```yaml
# High-performance configuration example
generators:
  endpoint:
    enabled: true
    frequency: 300000  # 5,000 logs/second
    templates:
      - level: INFO
        messageTemplate: "HTTP {method} {path} - {status} {responseTime}ms"
        probability: 1.0

output:
  format: json
  destination: http  # Network output for best performance
  batching:
    maxBatchSize: 1000
    flushIntervalMs: 100
    enabled: true
```

## 🌐 SIEM Integration & Network Output

### Supported Output Destinations

#### **HTTP Integration**
Direct integration with SIEM REST APIs:

```yaml
output:
  format: json
  destination: http
  http:
    url: "https://your-splunk.com:8088/services/collector/event"
    headers:
      "Authorization": "Splunk your-hec-token"
      "Content-Type": "application/json"
```

#### **Syslog Integration**
RFC3164/5424 compliant syslog output:

```yaml
output:
  format: syslog
  destination: syslog
  syslog:
    host: "your-siem.company.com"
    port: 514
    protocol: "udp"
```

#### **File Output (Default)**
Local file storage in `logs/current/` folder:

```yaml
output:
  format: json
  destination: file
  file:
    path: ./logs/current/logs.json
    rotation: true
    maxSize: 1GB
    maxFiles: 10
```

### Performance Comparison

| **Output Method** | **Performance** | **Use Case** |
|---|---|---|
| **File (Disk)** | 100-1,000 logs/sec | Development, testing |
| **HTTP (Network)** | 5,000-20,000 logs/sec | Production SIEM integration |
| **Syslog (UDP)** | 10,000+ logs/sec | Traditional SIEM systems |
| **Worker Threads** | 20,000+ logs/sec | High-volume scenarios |

### Usage Examples

```bash
# Test HTTP SIEM integration
npm run performance-test -- --mode http --duration 10s

# Test Syslog integration
npm run performance-test -- --mode syslog --duration 10s

# Compare all output methods
node src/scripts/performance-comparison.js
```

## 🔄 Advanced Replay Features

### Batch Processing
High-performance replay with configurable batch sizes:

```bash
# Standard replay
npm run replay -- --file logs_2025-09-04_12-00-47.jsonl --speed 2.0

# High-performance batch replay (19x faster)
npm run replay -- --file logs_2025-09-04_12-00-47.jsonl --batch-size 100 --speed 10

# Continuous loop replay
npm run replay -- --file logs_2025-09-04_12-00-47.jsonl --speed 5.0 --loop
```

### Time Range Filtering
Replay specific time windows:

```bash
# Replay specific time range
npm run replay -- --file logs_2025-09-04_12-00-47.jsonl \
  --start-time "2025-09-04T06:30:47.000Z" \
  --end-time "2025-09-04T06:30:48.000Z"
```

### Automatic Timestamp Fixing
Resolve duplicate timestamps during replay:

```bash
# Analyze and fix timestamp issues
npm run analyze -- --file logs_2025-09-04_12-00-47.jsonl --fix
```

## 📊 Performance Testing & Optimization

### Comprehensive Performance Testing

```bash
# Run performance test with different modes
npm run performance-test -- --mode worker --workers 4 --duration 30s
npm run performance-test -- --mode http --duration 10s
npm run performance-test -- --mode syslog --duration 10s

# Custom configuration testing
npm run performance-test -- --config src/config/high-performance.yaml --duration 1m
```

### Performance Monitoring

```bash
# Check system performance statistics
npm run status

# Validate configuration for performance issues
npm run validate-config --config src/config/extreme-performance.yaml
```

### Optimization Guidelines

#### **Hardware Recommendations**
- **CPU** - Multi-core processor (4+ cores recommended)
- **Memory** - 8GB+ RAM for high-performance mode
- **Storage** - SSD/NVMe for disk-based output
- **Network** - Gigabit connection for SIEM integration

#### **Configuration Optimization**
- **Batch Sizes** - 100-1000 logs per batch for network output
- **Flush Intervals** - 50-200ms for optimal performance
- **Worker Count** - Match CPU core count
- **Memory Buffers** - 5,000-10,000 logs for memory-first approach

## 🛡️ Security Operations Center (SOC) Simulation

### SOC Scenarios

Generate realistic SOC analyst activities and defensive responses:

```bash
# List available SOC scenarios
npm run soc-simulation:scenarios

# Run incident response simulation
npm run soc-simulation:run incident-response --duration 1h

# Run threat hunting simulation
npm run soc-simulation:run threat-hunting --duration 30m

# Check D3FEND coverage in SOC activities
npm run soc-simulation:d3fend-coverage
```

### SOC Activity Types

#### **Incident Response**
- Alert triage and investigation
- Evidence collection and analysis
- Containment and remediation actions
- Post-incident reporting

#### **Threat Hunting**
- Proactive threat searching
- Behavioral analysis
- IOC investigation
- Threat intelligence correlation

#### **Security Monitoring**
- Real-time alert monitoring
- Dashboard analysis
- Compliance checking
- Performance monitoring

## ⚙️ Configuration Validation

### Validation Features

The configuration validator provides comprehensive checks for safety and performance:

#### **Performance Validation**
- **Advisory Warnings** - Performance recommendations without blocking execution
- **Frequency Analysis** - Logs/second calculations and hardware requirements
- **Resource Estimation** - Disk I/O and memory usage predictions
- **Batch Optimization** - Optimal batch size recommendations

#### **Safety Validation**
- **Configuration Errors** - Missing required fields and invalid values
- **Compatibility Checks** - SIEM integration compatibility
- **Security Validation** - Secure configuration practices

### Usage Examples

```bash
# Validate configuration file
npm run validate-config --config src/config/extreme-performance.yaml

# Get JSON output for automation
npm run validate-config --config src/config/default.yaml --json

# Validate with detailed recommendations
npm run validate-config
```

### Validation Output Example

```
🔍 Validating Configuration...

✅ Configuration is valid!

⚠️ Warnings:
   ⚠️ EXTREME: Generator 'endpoint' frequency 720,000 (12,000 logs/sec) - Requires high-end hardware
   ⚠️ HIGH: Total system frequency 1,200,000 logs/min (20,000 logs/sec) - Monitor system resources

💡 Recommendations:
   💡 For generator 'endpoint': Ensure SSD/NVMe storage, sufficient RAM (8GB+)
   💡 EXTREME PERFORMANCE SETUP: Use enterprise-grade hardware, NVMe SSD storage, 16GB+ RAM
   💡 MONITORING: Set up system monitoring for CPU, memory, disk I/O, and network usage
```

## 🔧 Advanced Configuration Examples

### High-Performance Network Output

```yaml
# Optimized for SIEM HTTP integration
generators:
  endpoint:
    enabled: true
    frequency: 300000  # 5,000 logs/second
  application:
    enabled: true
    frequency: 180000  # 3,000 logs/second

output:
  format: json
  destination: http
  batching:
    maxBatchSize: 1000
    flushIntervalMs: 100
    enabled: true
  http:
    url: "https://your-siem.com/api/logs"
    headers:
      "Authorization": "Bearer your-token"
      "Content-Type": "application/json"
```

### ML-Enhanced Generation

```yaml
# Configuration for ML pattern learning
generators:
  authentication:
    enabled: true
    frequency: 60000
    ml_enhanced: true
    anomaly_rate: 0.1
    templates:
      - level: INFO
        messageTemplate: "User {userId} login from {sourceIp}"
        probability: 0.8
```

### Attack Chain Configuration

```yaml
# Custom attack chain template
name: "custom-apt-simulation"
description: "Custom APT simulation"
duration: 1800  # 30 minutes
stages:
  - name: "reconnaissance"
    duration: 300
    techniques: ["T1018", "T1082"]
    logs_per_minute: 10
  - name: "initial-access"
    duration: 600
    techniques: ["T1078", "T1190"]
    logs_per_minute: 20
```

## 📈 Real-time Monitoring & Metrics

The log generator includes comprehensive monitoring capabilities with built-in HTTP endpoints, Prometheus metrics, and Grafana dashboard integration.

### Built-in HTTP Endpoints

When the log generator is running with monitoring enabled (default), it automatically starts an HTTP server on port 3000 with the following endpoints:

> **Note**: Monitoring is optional and can be disabled by setting `ENABLE_MONITORING=false` to run the log generator without any HTTP server or monitoring overhead.

#### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

**Response Example:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-20T08:04:29.000Z",
  "uptime": 120,
  "version": "1.0.0",
  "performance": {
    "totalLogsGenerated": 156780,
    "logsPerSecond": 6050,
    "activeGenerators": ["api-gateway", "linux-server", "business-app"],
    "errorCount": 0
  }
}
```

#### Prometheus Metrics Endpoint
```bash
curl http://localhost:3000/metrics
```

**Available Metrics:**
- `log_generator_logs_total` - Total number of logs generated
- `log_generator_logs_per_second` - Current logs per second rate
- `log_generator_errors_total` - Total number of errors
- `log_generator_uptime_seconds` - Uptime in seconds
- `log_generator_by_source_total{generator="name"}` - Logs by generator
- `log_generator_active_generators{generator="name"}` - Active generator status

#### Detailed Status Endpoint
```bash
curl http://localhost:3000/status
```

**Response includes:**
- Service information and version
- Detailed performance metrics
- Individual generator statistics
- System uptime and health status

#### Disabling Monitoring (Optional)
```bash
# Run without any monitoring overhead
ENABLE_MONITORING=false npm run generate

# All core functionality works exactly the same
# No HTTP server, no metrics collection overhead
# Perfect for minimal resource usage scenarios
```

### Prometheus Integration

The log generator exports metrics in Prometheus format, making it easy to integrate with monitoring stacks:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'log-generator'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 5s
    metrics_path: /metrics
```

### Performance Monitoring

Monitor key performance indicators:

```promql
# Current generation rate
log_generator_logs_per_second

# Total logs generated
log_generator_logs_total

# Rate of log generation over time
rate(log_generator_logs_total[5m])

# Average logs per second over 1 minute
avg_over_time(log_generator_logs_per_second[1m])

# Logs by generator type
sum by (generator) (log_generator_by_source_total)
```

## 🐳 Docker & Kubernetes Deployment

### Docker Compose with Monitoring Stack

Deploy the complete monitoring stack with Docker Compose:

```bash
# Start log generator with Prometheus and Grafana
SIEM_HTTP_URL="http://localhost:8000/post" \
SIEM_API_TOKEN="test-token" \
GRAFANA_PASSWORD="admin123" \
docker-compose -f docker-compose.production.yml up -d
```

**Includes:**
- **Log Generator** - Main application with metrics
- **Prometheus** - Metrics collection (port 9090)
- **Grafana** - Visualization dashboards (port 3001)
- **Mock SIEM** - HTTPBin for testing (port 8000)

**Access URLs:**
- Grafana: http://localhost:3001 (admin/admin123)
- Prometheus: http://localhost:9090
- Log Generator Metrics: http://localhost:3000/metrics
- SIEM Test Endpoint: http://localhost:8000/post (POST requests)

### Kubernetes Production Deployment

Deploy to Kubernetes with auto-scaling and monitoring:

```bash
# Deploy complete stack
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n log-generator
kubectl get services -n log-generator

# View logs
kubectl logs -f deployment/log-generator -n log-generator

# Check metrics
kubectl port-forward svc/log-generator-service 3000:80 -n log-generator
curl http://localhost:3000/metrics
```

**Features:**
- **Auto-scaling** - HPA scales 2-10 pods based on CPU/memory
- **Persistent Storage** - 10Gi for logs, 5Gi for ML models
- **Health Checks** - Liveness, readiness, and startup probes
- **Service Discovery** - Automatic Prometheus scraping
- **Security** - Non-root containers, security contexts

### Grafana Dashboards

Pre-configured dashboards include:

1. **Log Generator Performance Dashboard**
   - Total logs generated (stat panel)
   - Current logs per second (stat panel)
   - Generation rate over time (time series)
   - Logs by generator (pie chart)
   - Active generators (stat panel)

2. **System Resource Dashboard**
   - CPU and memory usage
   - Disk I/O metrics
   - Network throughput
   - Error rates and alerts

### Monitoring Best Practices

1. **Set Up Alerts** - Configure Grafana alerts for:
   - Generation rate drops below threshold
   - Error rate exceeds acceptable limits
   - System resource exhaustion

2. **Dashboard Customization** - Modify dashboards for:
   - Your specific log volume requirements
   - Custom time ranges and refresh intervals
   - Team-specific metrics and KPIs

3. **Performance Tuning** - Use metrics to:
   - Identify optimal batch sizes
   - Monitor system resource utilization
   - Detect performance bottlenecks

## 🚀 Best Practices

### Performance Optimization
1. **Use Network Output** - HTTP/Syslog for production SIEM integration
2. **Enable Worker Threads** - For high-volume generation scenarios
3. **Optimize Batch Sizes** - 100-1000 logs per batch for network output
4. **Monitor Resources** - CPU, memory, and network utilization
5. **Use SSD Storage** - For disk-based output scenarios

### Security Considerations
1. **Validate Configurations** - Always run configuration validation
2. **Monitor System Resources** - Prevent resource exhaustion
3. **Secure SIEM Integration** - Use proper authentication and encryption
4. **Log Rotation** - Implement proper log rotation policies
5. **Access Control** - Restrict access to configuration files

### Production Deployment
1. **Start with Low Rates** - Gradually increase generation rates
2. **Test SIEM Integration** - Verify connectivity and data format
3. **Monitor Performance** - Use built-in performance testing tools
4. **Plan for Scale** - Consider hardware requirements for target rates
5. **Implement Monitoring** - Set up alerts for system health

---

For more detailed information, see the complete documentation in the respective MD files.