# ❓ Frequently Asked Questions

## 🔍 General Questions

### What is a SIEM log generator?
A SIEM (Security Information and Event Management) log generator is a tool that creates realistic security logs for testing, training, and development purposes. Our log generator specifically creates enterprise-grade logs with MITRE ATT&CK technique mapping, making it ideal for cybersecurity professionals who need realistic data for SIEM testing, SOC training, and security research.

### How is this different from other log generators?
Our log generator is unique because it:
- **Native MITRE ATT&CK Integration**: First open-source tool with built-in technique mapping
- **ML-Based Patterns**: Learns from historical data to generate realistic behavioral patterns
- **Attack Chain Simulation**: Multi-stage attack scenarios (APT29, ransomware, insider threats)
- **Enterprise Scale**: 238+ logs/minute across 12+ enterprise sources
- **SIEM Ready**: Direct integration with Wazuh, Splunk, ELK Stack

### Is this tool free to use?
Yes! This is completely open-source under the GPL v3 license. You can use it for:
- ✅ Commercial purposes
- ✅ Educational institutions
- ✅ Personal projects
- ✅ Enterprise environments
- ✅ Research and development

## 🛡️ SIEM Integration Questions

### Which SIEM solutions are supported?
We support all major SIEM platforms:
- **Wazuh**: Native agent format and syslog integration
- **Splunk**: Universal Forwarder and HEC (HTTP Event Collector)
- **ELK Stack**: Elasticsearch, Logstash, Kibana integration
- **IBM QRadar**: LEEF and syslog formats
- **ArcSight**: CEF (Common Event Format)
- **Generic**: JSON, syslog (RFC 3164/5424), CEF formats

### How do I integrate with Wazuh?
```bash
# Direct syslog integration
npm run generate -- --output syslog --host 127.0.0.1 --port 514

# File-based integration
npm run generate -- --output file --format wazuh
# Then configure Wazuh agent to monitor the log files
```

### Can I send logs directly to Splunk?
Yes, multiple methods:
```bash
# HTTP Event Collector (HEC)
npm run generate -- --output splunk-hec --token YOUR_HEC_TOKEN --host splunk.company.com

# Universal Forwarder monitoring
npm run generate -- --output file --format json
# Configure Universal Forwarder to monitor the log directory
```

### How do I set up ELK Stack integration?
```bash
# Generate JSON logs for Elasticsearch
npm run generate -- --output file --format json --directory /var/log/security/

# Configure Filebeat to ship logs to Elasticsearch
# Use our provided Filebeat configuration template
```

## 🎯 MITRE ATT&CK Questions

### What MITRE ATT&CK techniques are supported?
We support 14 techniques across 12 tactics:

**Initial Access (TA0001)**:
- T1078 - Valid Accounts
- T1110 - Brute Force

**Execution (TA0002)**:
- T1053 - Scheduled Task/Job
- T1059 - Command and Scripting Interpreter

**Persistence (TA0003)**:
- T1098 - Account Manipulation
- T1136 - Create Account

**Defense Evasion (TA0005)**:
- T1562 - Impair Defenses
- T1070 - Indicator Removal on Host

And more... See our [MITRE Coverage Documentation](MITRE_COVERAGE.md) for the complete list.

### How do I generate logs for a specific MITRE technique?
```bash
# Generate brute force attack logs (T1110)
npm run generate -- --mitre-technique T1110 --count 100

# Generate logs for specific tactic
npm run generate -- --mitre-tactic TA0006 --duration 30m

# List all supported techniques
npm run mitre-list
```

### Can I create custom MITRE mappings?
Yes! Edit the configuration file:
```yaml
# config/custom-mitre.yaml
sources:
  authentication:
    templates:
      - messageTemplate: "Custom attack pattern: {{details}}"
        mitre:
          technique: "T1110.001"
          tactic: "TA0006"
          subtechnique: "Password Guessing"
```

## 🔗 Attack Chain Questions

### What attack chains are available?
We provide three comprehensive attack chains:

1. **APT29 Cozy Bear** (45 minutes, 10 stages)
   - Nation-state attack simulation
   - Advanced persistent threat patterns
   - Stealth techniques and living-off-the-land

2. **Ryuk Ransomware** (30 minutes, 11 stages)
   - Enterprise ransomware campaign
   - Lateral movement and privilege escalation
   - Data encryption and ransom demands

3. **Malicious Insider** (25 minutes, 11 stages)
   - Data theft scenario
   - Privilege abuse and data exfiltration
   - Cover-up attempts

### How do I run an attack chain simulation?
```bash
# List available chains
npm run attack-chains:list

# Execute APT29 simulation
npm run attack-chains:execute apt29-cozy-bear

# Run with custom speed (2x faster)
npm run attack-chains:execute ransomware-ryuk --speed 2.0

# Monitor progress
npm run attack-chains:status
```

### Can I create custom attack chains?
Yes! Create a YAML template:
```yaml
# chains/templates/custom-attack.yaml
name: "Custom Attack Chain"
description: "Your custom attack scenario"
duration: "20m"
stages:
  - name: "Initial Access"
    duration: "2m"
    techniques: ["T1078"]
    logs:
      - source: "authentication"
        count: 10
        template: "failed_login"
```

## 🧠 Machine Learning Questions

### How does the ML pattern learning work?
Our ML engine analyzes historical logs to learn:
- **User Behavior Patterns**: Login times, application usage, error rates
- **System Performance**: CPU, memory, network usage patterns
- **Security Events**: Attack patterns and threat indicators
- **Temporal Patterns**: Time-based behaviors and anomalies

### What data do I need for ML training?
```bash
# Minimum requirements:
# - 1000+ log entries per source type
# - At least 7 days of historical data
# - JSON or structured log format

npm run ml-patterns:learn logs/historical/*.jsonl --min-samples 1000
```

### How accurate are the ML-generated logs?
Our ML engine achieves:
- **95%+ behavioral accuracy** for user patterns
- **90%+ temporal accuracy** for time-based events
- **85%+ anomaly detection** for security events
- **Configurable realism** with adjustable parameters

## ⚡ Performance Questions

### How many logs can it generate per minute?
- **Standard Mode**: 238+ logs/minute across all sources
- **High-Performance Mode**: 1000+ logs/minute (single source)
- **Burst Mode**: 5000+ logs/minute (short duration)
- **Enterprise Mode**: Configurable based on requirements

### What are the system requirements?
**Minimum**:
- Node.js 18+
- 512MB RAM
- 1GB disk space

**Recommended**:
- Node.js 20+
- 2GB RAM
- 10GB disk space
- SSD storage for high-volume generation

**Enterprise**:
- Node.js 20+
- 8GB RAM
- 100GB+ disk space
- High-performance SSD
- Multi-core CPU (4+ cores)

### Can it handle enterprise-scale deployments?
Yes! Our tool is designed for enterprise use:
- ✅ **Horizontal scaling**: Multiple instances
- ✅ **Load balancing**: Distribute across servers
- ✅ **Resource monitoring**: Built-in performance metrics
- ✅ **Graceful degradation**: Maintains performance under load
- ✅ **Docker support**: Container deployment ready

## 🔧 Technical Questions

### What output formats are supported?
- **JSON**: Structured data for modern SIEM solutions
- **Syslog**: RFC 3164/5424 compliant for traditional systems
- **CEF**: Common Event Format for security tools
- **LEEF**: Log Event Extended Format for IBM QRadar
- **Wazuh**: Native Wazuh agent format
- **Custom**: Configurable templates for any format

### Can I customize the log templates?
Absolutely! Edit the configuration:
```yaml
# config/custom-templates.yaml
sources:
  authentication:
    templates:
      - messageTemplate: "User {{user}} login from {{ip}} at {{timestamp}}"
        level: "INFO"
        probability: 0.8
        fields:
          user: "{{faker.internet.userName}}"
          ip: "{{faker.internet.ip}}"
```

### How do I add new log sources?
1. Create a new generator class extending `BaseGenerator`
2. Implement the `generateLogEntry()` method
3. Add templates to the configuration file
4. Register in `src/generators/index.ts`

See our [Development Guide](DEVELOPMENT.md) for detailed instructions.

## 🚀 Getting Started Questions

### What's the quickest way to start generating logs?
```bash
# 1. Clone and install
git clone https://github.com/your-username/log-generator.git
cd log-generator
npm install

# 2. Start generating (takes 30 seconds)
npm run generate

# 3. Check the logs
ls logs/current/
```

### How do I generate logs for my specific use case?
**SOC Training**:
```bash
npm run generate -- --mitre-technique T1110 --duration 1h
```

**SIEM Testing**:
```bash
npm run generate -- --performance-test --rate 500 --duration 30m
```

**Research**:
```bash
npm run ml-patterns:learn historical-data/*.jsonl
npm run ml-patterns:generate authentication --anomaly-rate 0.2
```

### Where can I get help?
- 📖 **Documentation**: Comprehensive guides in the `/docs` folder
- 💬 **GitHub Issues**: Report bugs and request features
- 🌟 **GitHub Discussions**: Community Q&A and best practices
- 📧 **Email Support**: security-team@yourcompany.com
- 🐦 **Twitter**: @LogGenSecurity for updates and tips

## 🔒 Security Questions

### Is it safe to use in production environments?
The log generator itself is safe, but consider:
- ✅ **Isolated testing**: Use in separate test environments
- ✅ **Data privacy**: Generated logs don't contain real user data
- ✅ **Network security**: Control where logs are sent
- ⚠️ **Resource usage**: Monitor system performance
- ⚠️ **Storage space**: Logs can consume significant disk space

### Does it generate real sensitive data?
No! All generated data is synthetic:
- **Usernames**: Faker.js generated names
- **IP Addresses**: RFC 1918 private ranges or fake IPs
- **Passwords**: Never included in logs
- **Personal Data**: Completely synthetic
- **Company Data**: Generic, non-identifying information

### Can I use this for compliance testing?
Yes, but with considerations:
- ✅ **GDPR**: Synthetic data, no real personal information
- ✅ **HIPAA**: No real healthcare data generated
- ✅ **PCI-DSS**: No real payment card data
- ✅ **SOX**: Audit trail capabilities for testing
- ⚠️ **Validation**: Always validate with compliance officers

---

**Still have questions?** Check our [GitHub Discussions](https://github.com/your-username/log-generator/discussions) or [open an issue](https://github.com/your-username/log-generator/issues/new)!
