# 🚀 Advanced Features Guide

This document covers the advanced features and detailed usage of the Log Generator.

## 📋 Table of Contents

- [🎯 MITRE ATT&CK Integration](#-mitre-attck-integration)
- [🔗 Attack Chain Simulation](#-attack-chain-simulation)
- [🧠 ML-Based Pattern Learning](#-ml-based-pattern-learning)
- [🔄 Advanced Replay Features](#-advanced-replay-features)
- [📊 Performance Optimization](#-performance-optimization)
- [🛡️ Enterprise SIEM Integration](#️-enterprise-siem-integration)

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

#### **Command and Control (TA0011)**
- **T1071.001** - Web Protocols: HTTP/HTTPS C2 communication

#### **Impact (TA0040)**
- **T1496** - Resource Hijacking: Cryptocurrency mining
- **T1499** - Endpoint Denial of Service: DoS attacks

### MITRE-Enhanced Commands

#### Generate Technique-Specific Logs
```bash
# Generate brute force attack logs for 30 minutes
npm run generate -- --mitre-technique T1110.001 --duration 30m

# Generate credential access logs for 1 hour
npm run generate -- --mitre-tactic TA0006 --duration 1h

# Generate only MITRE-mapped logs for 45 minutes
npm run generate -- --mitre-enabled --duration 45m
```

#### MITRE Analysis & Coverage
```bash
# List all supported techniques with descriptions
npm run mitre-list --techniques

# Analyze MITRE coverage in historical logs
npm run mitre-coverage --file logs/historical/dataset.jsonl

# Generate MITRE coverage report for all historical files
npm run mitre-coverage
```

### Use Cases
- **SOC Teams**: Test detection rules against specific MITRE techniques
- **Purple Teams**: Validate security controls with realistic attack patterns
- **Compliance**: Demonstrate coverage across MITRE framework
- **Training**: Learn MITRE techniques with realistic log examples

## 🔗 Attack Chain Simulation

Execute realistic multi-stage attack scenarios with precise timing, dependencies, and MITRE technique mapping.

### Available Attack Chains

#### 🐻 **APT29 Cozy Bear** (Advanced - 45 minutes)
**Nation-state attack simulation with 10 stages:**

1. **Initial Reconnaissance** (T1592, T1590) - 5 min
2. **Spear Phishing** (T1566.001) - 3 min
3. **Initial Access** (T1078) - 2 min
4. **Persistence Establishment** (T1053.005, T1547.001) - 5 min
5. **Privilege Escalation** (T1068) - 4 min
6. **Defense Evasion** (T1562.001) - 3 min
7. **Credential Harvesting** (T1003.001) - 8 min
8. **Lateral Movement** (T1021.001) - 6 min
9. **Data Collection** (T1005, T1039) - 5 min
10. **Exfiltration** (T1041) - 4 min

```bash
# Execute full APT29 scenario
npm run attack-chains:execute apt29-cozy-bear --speed 2.0

# Execute with custom output directory
npm run attack-chains:execute apt29-cozy-bear --output-dir apt29-logs/

# Continue on step failures
npm run attack-chains:execute apt29-cozy-bear --continue-on-failure
```

#### 💀 **Ryuk Ransomware** (Intermediate - 30 minutes)
**Enterprise ransomware campaign with 11 stages:**

1. **Initial Compromise** (T1566.001) - 2 min
2. **Execution** (T1059.003) - 2 min
3. **Discovery** (T1018, T1082) - 3 min
4. **Credential Access** (T1003.001) - 4 min
5. **Lateral Movement** (T1021.002) - 4 min
6. **Defense Evasion** (T1562.001) - 3 min
7. **Persistence** (T1053.005) - 2 min
8. **Data Discovery** (T1083) - 3 min
9. **Data Encryption** (T1486) - 4 min
10. **Ransom Note** (T1491.001) - 2 min
11. **Exfiltration Threat** (T1567.002) - 1 min

#### 🕵️ **Malicious Insider Data Theft** (Beginner - 25 minutes)
**Insider threat scenario with 11 stages:**

1. **Legitimate Access** (T1078.004) - 2 min
2. **System Discovery** (T1082, T1033) - 3 min
3. **File Discovery** (T1083) - 3 min
4. **Data Staging** (T1074.001) - 4 min
5. **Credential Harvesting** (T1555.003) - 3 min
6. **Privilege Escalation** (T1078.003) - 3 min
7. **Defense Evasion** (T1070.004) - 2 min
8. **Data Collection** (T1005) - 2 min
9. **Data Compression** (T1560.001) - 1 min
10. **Exfiltration Prep** (T1041) - 1 min
11. **Data Exfiltration** (T1567.001) - 1 min

### Attack Chain Commands

```bash
# List all available attack chains
npm run attack-chains:list

# Get detailed information about a specific chain
npm run attack-chains:info apt29-cozy-bear

# Execute with custom settings
npm run attack-chains:execute ransomware-ryuk \
  --speed 1.5 \
  --output-dir ryuk-simulation/ \
  --randomize-timing \
  --generate-report

# Monitor running attack chains
npm run attack-chains:status

# Abort a running attack chain
npm run attack-chains:abort <execution-id>

# Show MITRE technique coverage across all chains
npm run attack-chains:coverage
```

### Use Cases
- **Red Team Exercises**: Simulate realistic attack progressions
- **Blue Team Training**: Practice detection and response
- **SIEM Rule Testing**: Validate detection rules across attack stages
- **SOC Training**: Learn to identify attack progression patterns

## 🧠 ML-Based Pattern Learning

Learn from historical log data to generate realistic, behavior-based logs with advanced anomaly detection and context awareness.

### Core Capabilities

#### **Pattern Learning**
- **User Behavior Analysis**: Extract login patterns, application usage, error rates, and security awareness
- **System Performance Modeling**: Learn CPU, memory, and network usage patterns for realistic system logs
- **Security Event Correlation**: Identify and replicate attack patterns and threat indicators
- **Temporal Pattern Recognition**: Understand time-based patterns for realistic log timing
- **Cross-Source Correlation**: Learn relationships between different log sources

#### **Behavioral Modeling**
- **Working Hours Detection**: Learn user and system activity patterns by time of day
- **Application Usage Patterns**: Model typical application access and usage behaviors
- **Error Rate Analysis**: Generate realistic error distributions based on historical data
- **Security Awareness Scoring**: Model user security behavior and risk tolerance

#### **Anomaly Generation**
- **Realistic Security Anomalies**: Generate believable security events with proper context
- **Configurable Severity Distribution**: Control the mix of low, medium, high, and critical anomalies
- **Context-Aware Timing**: Generate anomalies at realistic times based on learned patterns
- **Multi-Source Correlation**: Create anomalies that span multiple log sources

### ML Pattern Commands

#### **Learning from Historical Data**
```bash
# Learn patterns from multiple log files
npm run ml-patterns:learn logs/historical/*.jsonl --min-samples 1000

# Learn with custom configuration
npm run ml-patterns:learn logs/historical/*.jsonl \
  --learning-rate 0.02 \
  --max-history-days 60 \
  --output-dir models/custom/

# Learn patterns focusing on specific aspects
npm run ml-patterns:learn logs/historical/*.jsonl \
  --focus user \
  --min-samples 500
```

#### **Generating ML-Based Logs**
```bash
# Generate authentication logs with learned patterns
npm run ml-patterns:generate authentication \
  --count 100 \
  --anomaly-rate 0.15 \
  --user-id john.doe

# Generate system logs with performance patterns
npm run ml-patterns:generate server \
  --count 50 \
  --system-id web-server-01 \
  --output ml-system-logs.jsonl

# Generate logs in different formats
npm run ml-patterns:generate firewall \
  --count 200 \
  --format syslog \
  --anomaly-rate 0.1
```

#### **Pattern Analysis**
```bash
# Analyze patterns in existing log files
npm run ml-patterns:analyze logs/current/*.jsonl \
  --focus security \
  --output analysis-report.json

# Analyze specific pattern types
npm run ml-patterns:analyze logs/historical/*.jsonl \
  --focus user \
  --json

# Generate comprehensive analysis report
npm run ml-patterns:analyze logs/historical/*.jsonl \
  --output detailed-analysis.json \
  --detailed
```

#### **Engine Management**
```bash
# Check ML engine status
npm run ml-patterns:status --detailed

# Configure ML parameters
npm run ml-patterns:config --set learning.learningRate=0.03
npm run ml-patterns:config --set anomalyGeneration.anomalyRate=0.08

# Reset learned patterns
npm run ml-patterns:reset --confirm

# Load configuration from file
npm run ml-patterns:config --file ml-config.json
```

### Configuration Options

#### **Learning Configuration**
```yaml
learning:
  enabled: true
  learningRate: 0.01          # How quickly patterns adapt
  adaptationPeriod: 24        # Hours between model updates
  minSampleSize: 1000         # Minimum logs required for learning
  maxHistoryDays: 30          # Maximum days of historical data to consider
```

#### **Pattern Application**
```yaml
patternApplication:
  userBehaviorWeight: 0.4     # Weight of user behavior patterns
  systemBehaviorWeight: 0.3   # Weight of system behavior patterns
  securityEventWeight: 0.2    # Weight of security event patterns
  randomnessLevel: 0.1        # Amount of randomness to inject
```

#### **Anomaly Generation**
```yaml
anomalyGeneration:
  enabled: true
  anomalyRate: 0.05          # Percentage of logs that should be anomalous
  realismLevel: 0.8          # How realistic anomalies should be (0-1)
  severityDistribution:
    low: 0.6                 # 60% low severity
    medium: 0.3              # 30% medium severity
    high: 0.08               # 8% high severity
    critical: 0.02           # 2% critical severity
```

### Use Cases
- **Realistic Testing**: Generate logs that mirror actual user and system behavior
- **Anomaly Detection Training**: Create realistic security anomalies for ML model training
- **Behavioral Baselines**: Establish normal behavior patterns for deviation detection
- **Dynamic Scenarios**: Generate logs that adapt to different time periods and contexts
- **Advanced Simulation**: Create sophisticated attack scenarios with realistic user interactions

## 🔄 Advanced Replay Features

### Speed Control & Timing
```bash
# Replay at 2x speed
npm run replay dataset.jsonl --speed 2.0

# Replay at half speed for detailed analysis
npm run replay dataset.jsonl --speed 0.5

# Replay with original timing preserved
npm run replay dataset.jsonl --realtime
```

### Time Range Filtering
```bash
# Replay specific date range
npm run replay dataset.jsonl \
  --start "2024-01-01 00:00:00" \
  --end "2024-01-01 23:59:59"

# Replay last 24 hours of data
npm run replay dataset.jsonl --last 24h

# Replay specific time window
npm run replay dataset.jsonl \
  --time-window "09:00-17:00"
```

### Advanced Filtering
```bash
# Replay only error logs
npm run replay dataset.jsonl --level ERROR

# Replay specific log sources
npm run replay dataset.jsonl --sources authentication,firewall

# Replay with MITRE technique filtering
npm run replay dataset.jsonl --mitre-technique T1110

# Replay with custom filters
npm run replay dataset.jsonl \
  --filter "metadata.user_id=admin" \
  --filter "level!=DEBUG"
```

### Loop & Continuous Replay
```bash
# Replay continuously in a loop
npm run replay dataset.jsonl --loop

# Replay with limited iterations
npm run replay dataset.jsonl --loop --max-iterations 5

# Replay with delay between iterations
npm run replay dataset.jsonl --loop --iteration-delay 30s
```

## 📊 Performance Optimization

### High-Volume Generation
```bash
# Generate high-volume logs with optimized settings
npm run generate --high-volume \
  --frequency-multiplier 5.0 \
  --batch-size 1000 \
  --memory-limit 512MB
```

### Resource Management
```bash
# Monitor resource usage
npm run status --resources

# Set memory limits
npm run generate --memory-limit 256MB

# Configure concurrent generators
npm run generate --max-concurrent 8
```

### Batch Processing
```bash
# Generate logs in batches
npm run generate --batch-mode \
  --batch-size 10000 \
  --batch-interval 60s \
  --output-rotation daily
```

## 🛡️ Enterprise SIEM Integration

### Advanced Wazuh Integration
```bash
# Send logs with custom Wazuh rules
npm run generate --output wazuh \
  --wazuh-host 192.168.1.100 \
  --wazuh-port 1514 \
  --wazuh-protocol tcp

# Generate logs with Wazuh rule testing
npm run generate --wazuh-rule-test \
  --rule-file custom-rules.xml
```

### Splunk Enterprise Integration
```bash
# Generate logs for Splunk with proper indexing
npm run generate --output splunk \
  --splunk-index security \
  --splunk-sourcetype custom:security:logs

# Generate Splunk-compatible CEF logs
npm run generate --format cef \
  --cef-version 0.1 \
  --cef-device-vendor "LogGenerator"
```

### ELK Stack Integration
```bash
# Generate logs for Elasticsearch with proper mapping
npm run generate --output elasticsearch \
  --es-host localhost:9200 \
  --es-index security-logs \
  --es-type security

# Generate with Logstash pipeline
npm run generate --output logstash \
  --logstash-host localhost:5044 \
  --logstash-protocol beats
```

### Custom SIEM Integration
```bash
# Generate logs with custom headers
npm run generate --output http \
  --http-endpoint https://siem.company.com/api/logs \
  --http-headers "Authorization: Bearer token123" \
  --http-headers "Content-Type: application/json"

# Generate with custom formatting
npm run generate --output custom \
  --custom-format "{{timestamp}} {{level}} {{source}}: {{message}}" \
  --custom-delimiter "|"
```
