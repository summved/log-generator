# 🚀 Enterprise SIEM Log Generator | MITRE ATT&CK | Cybersecurity Training

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SIEM Compatible](https://img.shields.io/badge/SIEM-Wazuh%20%7C%20Splunk%20%7C%20ELK-orange)](https://github.com/your-username/log-generator)
[![Security Training](https://img.shields.io/badge/Security-Training%20Ready-red)](https://github.com/your-username/log-generator)

**The most comprehensive open-source cybersecurity log generator** for SIEM testing, security training, and threat simulation. Generate realistic enterprise logs with **MITRE ATT&CK framework integration**, **ML-based behavioral patterns**, and **attack chain simulation**.

Perfect for **SOC analysts**, **penetration testers**, **security researchers**, and **cybersecurity educators** who need realistic log data for testing SIEM rules, training detection capabilities, and simulating real-world attack scenarios.

🎯 **Generate realistic logs from 12+ enterprise sources** | 🛡️ **MITRE ATT&CK technique mapping** | 🧠 **ML pattern learning** | ⚡ **238+ logs/minute**

## 🎯 Key Features

- **🎯 MITRE ATT&CK Integration** - Generate logs mapped to specific techniques and tactics
- **🔗 Attack Chain Simulation** - Execute multi-stage scenarios (APT29, Ransomware, Insider Threats)
- **🧠 ML-Based Pattern Learning** - Generate realistic, behavior-based logs using machine learning
- **⚡ High-Volume Generation** - 238+ logs/minute across 12 enterprise sources
- **🔄 Historical Replay** - Replay and analyze existing log data with advanced filtering
- **🛡️ SIEM Ready** - Direct integration with Wazuh, Splunk, ELK, and other SIEM solutions

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/your-username/log-generator.git
cd log-generator
npm install
```

### Generate Logs
```bash
# Start generating logs from all sources
npm run generate

# Generate MITRE-specific logs
npm run generate -- --mitre-technique T1110 --mitre-tactic TA0006

# Run attack chain simulation
npm run attack-chains:execute apt29-cozy-bear --speed 2.0

# Learn from historical data and generate ML-based logs
npm run ml-patterns:learn logs/historical/*.jsonl
npm run ml-patterns:generate authentication --count 100
```

## 📋 Log Sources (238 logs/min)

| **Category** | **Sources** | **Logs/Min** |
|---|---|---|
| **🏗️ Infrastructure** | API Gateway, Applications, Linux Servers, Firewalls, Cloud (AWS) | 65 |
| **🔐 Security & Identity** | Authentication, Web Servers | 40 |
| **💾 Data & Storage** | Databases (PostgreSQL), Backup Systems | 38 |
| **🚀 Modern Architecture** | Microservices, Email Systems, IoT Devices | 95 |

## 🎯 MITRE ATT&CK Integration

Generate logs mapped to **14 MITRE techniques** across **12 tactics**:

```bash
# Generate brute force attack logs
npm run generate -- --mitre-technique T1110.001

# List all supported techniques
npm run mitre-list

# Analyze MITRE coverage in historical logs
npm run mitre-coverage logs/historical/
```

**Supported Techniques**: T1110 (Brute Force), T1078 (Valid Accounts), T1098 (Account Manipulation), T1562 (Impair Defenses), and more.

## 🔗 Attack Chain Simulation

Execute realistic multi-stage attack scenarios:

```bash
# List available attack chains
npm run attack-chains:list

# Execute APT29 Cozy Bear attack (45 minutes, 10 stages)
npm run attack-chains:execute apt29-cozy-bear

# Execute Ryuk Ransomware attack (30 minutes, 11 stages)  
npm run attack-chains:execute ransomware-ryuk

# Monitor attack chain status
npm run attack-chains:status
```

**Available Chains:**
- **🐻 APT29 Cozy Bear** - Advanced nation-state attack (45 min, 10 stages)
- **💀 Ryuk Ransomware** - Enterprise ransomware campaign (30 min, 11 stages)
- **🕵️ Malicious Insider** - Data theft scenario (25 min, 11 stages)

## 🧠 ML-Based Pattern Learning

Learn from historical data to generate realistic, behavior-based logs:

```bash
# Learn patterns from historical data
npm run ml-patterns:learn logs/historical/*.jsonl --min-samples 100

# Generate ML-enhanced logs
npm run ml-patterns:generate authentication --count 50 --anomaly-rate 0.1

# Check ML engine status
npm run ml-patterns:status

# Analyze existing patterns
npm run ml-patterns:analyze logs/current/*.jsonl
```

**ML Capabilities:**
- **User Behavior Analysis** - Login patterns, application usage, error rates
- **System Performance Modeling** - CPU, memory, network usage patterns  
- **Security Event Correlation** - Attack patterns and threat indicators
- **Anomaly Generation** - Realistic security anomalies with configurable severity

## 🔄 Log Replay & Analysis

Replay and analyze historical log data:

```bash
# Replay logs with speed control
npm run replay logs/historical/dataset.jsonl --speed 2.0 --loop

# Analyze timestamp quality
npm run analyze logs/historical/dataset.jsonl --fix-duplicates

# Replay specific time range
npm run replay logs/historical/dataset.jsonl --start "2024-01-01" --end "2024-01-02"
```

## 🛡️ SIEM Integration

### Wazuh Integration
```bash
# Send logs directly to Wazuh agent
npm run generate -- --output syslog --host 127.0.0.1 --port 514
```

### ELK Stack Integration
```bash
# Generate logs in JSON format for Elasticsearch
npm run generate -- --output file --format json
```

### Splunk Integration
```bash
# Generate logs in CEF format for Splunk
npm run generate -- --output file --format cef
```

## 📊 Output Formats

- **JSON** - Structured data for modern SIEM solutions
- **Syslog** - RFC 3164/5424 compliant for traditional systems  
- **CEF** - Common Event Format for security tools
- **Wazuh** - Native Wazuh agent format

## ⚙️ Configuration

Customize log generation with YAML configuration:

```yaml
# config/custom.yaml
sources:
  authentication:
    enabled: true
    frequency: 30  # logs per minute
    templates:
      - messageTemplate: "User {{user}} login from {{ip}}"
        level: INFO
        probability: 0.8
        mitre:
          technique: "T1078"
          tactic: "TA0001"
```

```bash
npm run generate -- --config config/custom.yaml
```

## 🔧 CLI Commands

| **Category** | **Command** | **Description** |
|---|---|---|
| **Generation** | `npm run generate` | Start log generation |
| **Replay** | `npm run replay <file>` | Replay historical logs |
| **Analysis** | `npm run analyze <file>` | Analyze log quality |
| **MITRE** | `npm run mitre-list` | List MITRE techniques |
| **Attack Chains** | `npm run attack-chains:list` | List attack scenarios |
| **ML Patterns** | `npm run ml-patterns:learn` | Learn from historical data |
| **Status** | `npm run status` | Show generation status |

## 📚 Documentation & Resources

| **Guide** | **Description** | **Audience** |
|---|---|---|
| **[🚀 Quick Start Guide](QUICK_START.md)** | Get started in 5 minutes | All users |
| **[❓ FAQ - Common Questions](FAQ.md)** | Frequently asked questions and troubleshooting | All users |
| **[🎯 Use Cases & Solutions](USE_CASES.md)** | Role-specific implementation guides | SOC, Red Team, Educators |
| **[📋 Log Types Reference](LOG_TYPES_REFERENCE.md)** | Complete breakdown of all 12 log sources | Technical users |
| **[⚙️ Configuration Guide](CONFIGURATION.md)** | Detailed configuration options | Advanced users |
| **[🛡️ SIEM Integration](SIEM_INTEGRATION.md)** | Integration with Wazuh, Splunk, ELK Stack | SIEM administrators |
| **[🔧 Technical Guide](SIEM_TECHNICAL_GUIDE.md)** | Advanced usage and troubleshooting | DevOps, Engineers |
| **[📊 System Requirements](SYSTEM_REQUIREMENTS.md)** | Performance specs and requirements | IT administrators |
| **[📈 Log Analysis](LOG_ANALYSIS.md)** | Analysis tools and quality metrics | Security analysts |
| **[🏗️ Code Architecture](CODE_ARCHITECTURE.md)** | Developer documentation and API reference | Developers |
| **[🤝 Community & Support](COMMUNITY_OUTREACH.md)** | Getting help and contributing | Community members |

## 🎯 Use Cases

- **🔒 Security Testing** - Test SIEM rules and detection capabilities
- **📚 Training & Education** - Cybersecurity training with realistic scenarios
- **🧪 Development** - Generate consistent test data for applications
- **⚡ Performance Testing** - Load test log ingestion systems
- **🎭 Incident Simulation** - Recreate attack scenarios for analysis
- **🔄 Continuous Testing** - Automated testing in CI/CD pipelines

## 🚀 Performance

- **238+ logs/minute** across all sources
- **Memory efficient** - <100MB RAM usage
- **High-volume replay** - Tested with 1M+ log datasets
- **Concurrent generation** - Multi-source parallel processing
- **Timestamp accuracy** - Microsecond precision with duplicate detection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MITRE ATT&CK Framework** - For the comprehensive threat modeling framework
- **Wazuh Community** - For SIEM integration insights
- **Security Research Community** - For attack pattern validation

---

**⭐ Star this repository if it helps with your security testing and SIEM development!**