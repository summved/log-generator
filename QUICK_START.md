# 🚀 Quick Start Guide - Get Running in 5 Minutes

## ⚡ 30-Second Setup

```bash
# 1. Clone and install (2 minutes)
git clone https://github.com/your-username/log-generator.git
cd log-generator
npm install

# 2. Start generating logs (30 seconds)
npm run generate

# 3. Check your logs
ls logs/current/
```

**That's it!** You now have realistic security logs being generated at 238+ logs/minute across 12 enterprise sources.

## 🎯 Common Use Cases (Choose Your Path)

### 🛡️ SOC Analyst - Test Detection Rules
```bash
# Generate brute force attack logs for testing
npm run generate -- --mitre-technique T1110 --duration 30m

# View the logs
tail -f logs/current/authentication_*.jsonl
```

### 🔴 Red Team - Attack Simulation
```bash
# Run APT29 attack chain simulation
npm run attack-chains:execute apt29-cozy-bear

# Monitor progress
npm run attack-chains:status
```

### 🎓 Educator - Classroom Setup
```bash
# Generate diverse logs for training
npm run generate -- --duration 2h

# Create student lab environment with custom config
npm run generate -- --config config/classroom-lab.yaml --duration 1h
```

### 🏢 Enterprise - SIEM Testing
```bash
# Generate logs for SIEM testing
npm run generate -- --duration 1h

# Monitor logs directory for SIEM ingestion
# Configure your SIEM to monitor logs/current/ directory
```

## 🛡️ SIEM Integration (Pick Your Platform)

### Wazuh
```bash
# Generate logs for Wazuh monitoring
npm run generate -- --duration 1h

# Configure Wazuh agent to monitor logs/current/ directory
# Logs are generated in JSON format by default
```

### Splunk
```bash
# Generate logs for Splunk ingestion
npm run generate -- --duration 2h

# Configure Universal Forwarder to monitor logs/current/ directory
# Logs are generated in JSON format by default
```

### ELK Stack
```bash
# Generate JSON logs for Elasticsearch
npm run generate -- --duration 3h

# Configure Filebeat to monitor logs/current/ directory
# Logs are generated in JSON format by default
```

## 🎯 MITRE ATT&CK Quick Reference

### Most Common Techniques
```bash
# Brute Force (T1110) - Authentication attacks
npm run generate -- --mitre-technique T1110

# Valid Accounts (T1078) - Legitimate credential abuse
npm run generate -- --mitre-technique T1078

# Account Manipulation (T1098) - Privilege escalation
npm run generate -- --mitre-technique T1098

# List all supported techniques
npm run mitre-list
```

### Attack Chain Simulations
```bash
# List available attack chains
npm run attack-chains:list

# Quick 15-minute insider threat simulation
npm run attack-chains:execute insider-threat-data-theft --speed 3.0

# Full APT29 nation-state attack (45 minutes)
npm run attack-chains:execute apt29-cozy-bear
```

## 🧠 Machine Learning Quick Start

### Learn from Your Historical Data
```bash
# Analyze existing logs to learn patterns
npm run ml-patterns:learn logs/historical/*.jsonl --min-samples 100

# Generate ML-enhanced realistic logs
npm run ml-patterns:generate authentication --count 100 --anomaly-rate 0.1

# Check ML engine status
npm run ml-patterns:status
```

## 📊 Output Formats

### JSON (Default - Best for Modern SIEMs)
```bash
npm run generate -- --format json
```
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "source": "authentication",
  "level": "WARN",
  "message": "Failed login attempt for user jdoe from 192.168.1.100",
  "mitre": {
    "technique": "T1110.001",
    "tactic": "TA0006"
  }
}
```

### Syslog (Traditional SIEMs)
```bash
npm run generate -- --format syslog
```
```
Jan 15 10:30:45 server01 auth: Failed login attempt for user jdoe from 192.168.1.100
```

### CEF (Security Tools)
```bash
npm run generate -- --format cef
```
```
CEF:0|LogGenerator|Authentication|1.0|T1110|Failed Login|3|src=192.168.1.100 suser=jdoe
```

## ⚙️ Configuration Quick Tips

### Custom Log Templates
Create `config/custom.yaml`:
```yaml
sources:
  authentication:
    enabled: true
    frequency: 60  # logs per minute
    templates:
      - messageTemplate: "User {{user}} login from {{ip}}"
        level: INFO
        probability: 0.8
        mitre:
          technique: "T1078"
          tactic: "TA0001"
```

### Environment Variables
```bash
# Set default output directory
export LOG_OUTPUT_DIR="/var/log/security"

# Set SIEM connection details
export SIEM_HOST="192.168.1.100"
export SIEM_PORT="514"

# Run with environment settings
npm run generate
```

## 🔧 Troubleshooting

### Common Issues & Solutions

**Issue**: "Permission denied writing to logs directory"
```bash
# Solution: Create directory with proper permissions
sudo mkdir -p /var/log/security
sudo chown $USER:$USER /var/log/security
```

**Issue**: "High CPU usage during generation"
```bash
# Solution: Use shorter durations or configure lower frequency in config files
npm run generate -- --duration 30m  # Run for shorter periods
```

**Issue**: "Logs not appearing in SIEM"
```bash
# Solution: Check if logs are being generated
ls -la logs/current/

# Verify SIEM is monitoring the correct directory
# Default log location: logs/current/
```

**Issue**: "Out of disk space"
```bash
# Solution: Clean up old logs or use shorter durations
rm -f logs/current/*.jsonl  # Clean current logs
rm -f logs/historical/*.jsonl  # Clean historical logs
```

## 📈 Performance Tuning

### For High-Volume Generation
```bash
# Generate logs continuously (stop with Ctrl+C)
npm run generate

# Monitor resource usage and status
npm run status
```

### For Low-Resource Environments
```bash
# Use shorter durations to reduce resource usage
npm run generate -- --duration 15m

# Configure lower frequencies in config files for specific sources
```

## 🆘 Getting Help

### Built-in Help
```bash
# General help
npm run generate --help

# Command-specific help
npm run attack-chains:execute --help
npm run ml-patterns:learn --help
```

### Documentation
- **[FAQ](FAQ.md)** - Common questions and solutions
- **[Use Cases](USE_CASES.md)** - Role-specific guides
- **[SIEM Integration](SIEM_INTEGRATION.md)** - Detailed integration guides

### Community Support
- **GitHub Issues**: [Report bugs or request features](https://github.com/your-username/log-generator/issues)
- **GitHub Discussions**: [Community Q&A](https://github.com/your-username/log-generator/discussions)
- **Twitter**: [@LogGenSecurity](https://twitter.com/LogGenSecurity) for updates and tips

## 🚀 Next Steps

### Explore Advanced Features
1. **[Attack Chain Simulation](ADVANCED_FEATURES.md#attack-chains)** - Multi-stage attack scenarios
2. **[ML Pattern Learning](ADVANCED_FEATURES.md#ml-patterns)** - Behavioral analysis and generation
3. **[Custom Generators](DEVELOPMENT.md)** - Build your own log sources
4. **[Performance Optimization](SYSTEM_REQUIREMENTS.md)** - Enterprise-scale deployment

### Join the Community
1. ⭐ **Star the repository** if it's helpful
2. 🍴 **Fork and contribute** new features or improvements
3. 💬 **Join discussions** and share your use cases
4. 📢 **Spread the word** to help other cybersecurity professionals

---

**🎉 Congratulations!** You're now generating realistic security logs with MITRE ATT&CK integration. Ready to enhance your SIEM testing and security training!
