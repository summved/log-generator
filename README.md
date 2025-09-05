# 🚀 Log Generator and Replay Log Collector

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A comprehensive multi-source log generator designed for SIEM solutions like Wazuh. Generate realistic logs from **12 different sources** including endpoints, applications, servers, firewalls, cloud services, authentication systems, databases, web servers, email services, backup systems, microservices, and IoT devices - with the ability to replay historical logs.

## 🎯 Why Use This Tool?

- **🔒 Security Testing**: Test your SIEM rules and detection capabilities with realistic log data
- **📚 Training & Education**: Create reproducible scenarios for cybersecurity training
- **🧪 Development**: Generate consistent test data for log processing applications  
- **⚡ Performance Testing**: Load test your log ingestion systems with high-volume replay
- **🎭 Incident Simulation**: Recreate attack scenarios for analysis and response training
- **🔄 Continuous Testing**: Automated log generation for CI/CD pipelines

## 📋 What Logs Are Generated?

The log generator creates **realistic logs from 12 different enterprise sources**:

### 🏗️ **Infrastructure** (65 logs/min)
- **🌐 API Gateway**: HTTP requests, rate limiting, errors
- **📱 Applications**: User actions, cache ops, database connections  
- **🖥️ Linux Servers**: System metrics, service management, alerts
- **🛡️ Firewalls**: Traffic filtering, intrusion detection
- **☁️ Cloud Services**: AWS API calls, auto-scaling, Lambda

### 🔐 **Security & Identity** (40 logs/min)  
- **🔑 Authentication**: Login/logout, failed attempts, lockouts
- **🌐 Web Servers**: Access logs, SSL certificates, timeouts

### 💾 **Data & Storage** (38 logs/min)
- **🗄️ Databases**: Query execution, transactions, performance
- **💾 Backup Systems**: Operations, storage monitoring, cleanup

### 🚀 **Modern Architecture** (95 logs/min)
- **🔄 Microservices**: Service calls, circuit breakers, scaling
- **📧 Email Systems**: SMTP operations, spam detection
- **📱 IoT Devices**: Connectivity, sensors, firmware updates

> **📋 [Complete Log Types Reference →](LOG_TYPES_REFERENCE.md)**  
> *Detailed breakdown of every log type with examples*

## 📚 Documentation Quick Links

| **[📋 Log Types](LOG_TYPES_REFERENCE.md)** | **[⚙️ Configuration](CONFIGURATION.md)** | **[🛡️ SIEM Integration](SIEM_INTEGRATION.md)** | **[🔧 Technical Guide](SIEM_TECHNICAL_GUIDE.md)** |
|---|---|---|---|
| **What logs are generated** | Customize log rates & settings | Connect to any SIEM system | **Deep technical details** |

| **[💻 System Requirements](SYSTEM_REQUIREMENTS.md)** | **[🔬 Technical Analysis](LOG_ANALYSIS.md)** |
|---|---|
| Hardware & resource planning | Deep technical documentation |

## 📋 Table of Contents

- [🎯 Why Use This Tool?](#-why-use-this-tool)
- [📋 What Logs Are Generated?](#-what-logs-are-generated)
- [🚀 Quick Start](#-quick-start)
- [💻 CLI Usage](#-cli-usage)
- [⚙️ Configuration](#️-configuration)
- [🛡️ SIEM Integration](#️-siem-integration)
- [🔄 Replay System](#-replay-system)
- [🐳 Docker Deployment](#-docker-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📚 Complete Documentation](#-complete-documentation)

## Features

- **Multi-Source Log Generation**: Generate logs from **12 different sources** - endpoints, applications, servers, firewalls, cloud, authentication, database, web server, email, backup, microservices, and IoT devices
- **Historical Log Replay**: Replay stored logs with configurable speed and filters
- **Multiple Output Formats**: Support for JSON, Syslog, CEF, and Wazuh-specific formats
- **Flexible Output Destinations**: File, Syslog, HTTP endpoints, or stdout
- **Configurable Templates**: Customizable log templates with realistic data generation
- **Storage Management**: Automatic log rotation and cleanup
- **Docker Support**: Easy deployment with Docker and Docker Compose

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** ([Download here](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Git** ([Download here](https://git-scm.com/))

> 💻 **[System Requirements & Resource Usage →](SYSTEM_REQUIREMENTS.md)**  
> *CPU, memory, and storage requirements for different log volumes*

### 🏃‍♂️ 30-Second Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/log-generator.git
cd log-generator

# 2. Run the automated setup script
chmod +x scripts/test-install.sh
./scripts/test-install.sh

# 3. Start generating logs immediately!
npm run generate
```

### 📋 Manual Installation

#### Local Installation (Recommended for Development)

```bash
# 1. Clone and enter directory
git clone https://github.com/YOUR_USERNAME/log-generator.git
cd log-generator

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Initialize configuration
npx ts-node src/cli.ts init

# 5. Start generating logs
npm run generate
```

#### Using Docker (Recommended for Production)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/log-generator.git
cd log-generator

# 2. Start with Docker Compose
docker-compose up -d

# 3. View logs being generated
docker-compose logs -f log-generator
```

### ✅ Verify Installation

```bash
# Check if everything is working
npx ts-node src/cli.ts status

# View generated logs
tail -f logs/current/logs.json
```

### 📊 Quick Resource Overview

| Log Rate | CPU Usage | RAM Usage | Storage/Day | Use Case |
|----------|-----------|-----------|-------------|----------|
| **238 logs/min** (all 12 sources) | 10-15% | 150 MB | 136 MB | **Full Coverage Testing** |
| **65 logs/min** (5 sources) | 5-10% | 100 MB | 37 MB | Development, Training |
| **500 logs/min** | 15-25% | 300 MB | 288 MB | SIEM Testing |
| **2000 logs/min** | 40-60% | 700 MB | 1.15 GB | Load Testing |
| **5000+ logs/min** | 60-80% | 1+ GB | 2.9+ GB | Enterprise Stress Testing |

*Minimum: 1 vCPU, 512MB RAM • Recommended: 2+ vCPU, 1+ GB RAM*

## 💻 CLI Usage

The log generator includes a comprehensive CLI for various operations:

### 📊 Generate Logs
```bash
# Start log generation (interactive mode)
npm run generate

# Run in background/daemon mode
npm run generate -- --daemon

# Use custom configuration file
npm run generate -- --config ./my-config.yaml

# Generate logs for a specific duration (10 minutes)
timeout 600 npm run generate
```

### 🔄 Replay Historical Logs
```bash
# Replay all historical logs at normal speed
npm run replay

# Replay a specific file
npm run replay -- --file logs_2023-12-01.jsonl

# High-speed replay for load testing (10x speed)
npm run replay -- --speed 10 --file large_dataset.jsonl

# Continuous loop for sustained testing
npm run replay -- --speed 2 --loop --file test_scenario.jsonl

# Replay specific time range
npm run replay -- --start-time "2023-12-01T00:00:00Z" --end-time "2023-12-01T23:59:59Z"

# Slow replay for detailed analysis (0.5x speed)
npm run replay -- --speed 0.5 --file incident_logs.jsonl
```

### 📈 Status and Management
```bash
# Check generator and replay status
npx ts-node src/cli.ts status

# Show current configuration
npx ts-node src/cli.ts config --show

# Validate configuration file
npx ts-node src/cli.ts config --validate

# Initialize new configuration file
npx ts-node src/cli.ts init --output ./custom-config.yaml

# Help for all commands
npx ts-node src/cli.ts --help
```

### 🔍 Historical Data Analysis
```bash
# Analyze historical log files for timestamp issues
npm run analyze -- --file large_dataset.jsonl

# Analyze all historical files
npm run analyze

# Analyze and automatically fix duplicate timestamps
npm run analyze -- --file problematic.jsonl --fix

# Get detailed analysis report
npm run analyze -- --file logs_2023-12-01.jsonl

# Check current status of generators and replay
npm run status
```

### 📁 Log Management
```bash
# View current logs being generated
tail -f logs/current/logs.json

# Count total log entries
wc -l logs/current/logs.json

# View logs in JSON format (requires jq)
cat logs/current/logs.json | jq .

# Check disk usage of logs
du -sh logs/

# List all historical files
ls -la logs/historical/
```

## ⚙️ Configuration

The system uses a YAML configuration file and is **fully customizable** for different testing scenarios.

> 📋 **[Complete Configuration Guide →](CONFIGURATION.md)**  
> *Detailed guide for customizing log rates, creating presets, and advanced configuration options*

### Quick Configuration Overview

**Default Rates** (65 logs/minute total):
```yaml
generators:
  endpoint:
    enabled: true
    frequency: 10    # ← EASILY CUSTOMIZABLE (1-1000+ logs/min)
  application:
    frequency: 15    # ← Change to any rate you need
  server:
    frequency: 8     # ← Perfect for your testing scenario
  firewall:
    frequency: 20    # ← Adjust for security testing
  cloud:
    frequency: 12    # ← Enable/disable as needed
```

**🎯 Quick Customization Examples:**
- **Light Testing**: Set all frequencies to 1-5 (total: 5-25 logs/min)
- **Heavy Load**: Set all frequencies to 100-200 (total: 500-1000 logs/min)  
- **Security Focus**: Disable endpoint/app, set firewall to 100+ logs/min
- **Development**: Use 2-10 logs/min per source for easy debugging

**📝 How to Customize:**
```bash
# Method 1: Edit default config
nano src/config/default.yaml

# Method 2: Create custom config  
npx ts-node src/cli.ts init --output my-rates.yaml
npm run generate -- --config my-rates.yaml

# Method 3: Quick JSON output for any SIEM
cat > siem-config.yaml << EOF
output:
  format: "json"
  destination: "file"  
  file:
    path: "/var/log/siem/logs.json"
EOF
npm run generate -- --config siem-config.yaml
```

### Log Sources

1. **Endpoints**: API gateway logs, HTTP requests/responses
2. **Applications**: Business logic, database operations, cache operations
3. **Servers**: System metrics, service management, performance monitoring
4. **Firewalls**: Packet filtering, intrusion detection, connection tracking
5. **Cloud**: AWS CloudTrail, auto-scaling events, Lambda functions

### Template Variables

The system supports various template variables that are automatically replaced:

- `{timestamp}`, `{uuid}`, `{userId}`
- `{clientIP}`, `{srcIP}`, `{dstIP}`, `{srcPort}`, `{dstPort}`
- `{method}`, `{path}`, `{status}`, `{responseTime}`
- `{cpuUsage}`, `{memoryUsage}`, `{loadAverage}`
- `{protocol}`, `{ruleId}`, `{attackType}`
- `{service}`, `{operation}`, `{region}` (for cloud logs)

## 🛡️ SIEM Integration

The log generator supports **direct integration** with any SIEM system through multiple output methods:

> 🔗 **[Complete SIEM Integration Guide →](SIEM_INTEGRATION.md)**  
> *Detailed setup for Splunk, Elastic, QRadar, ArcSight, Wazuh, Sentinel, and more*

### Quick SIEM Setup

**Generic JSON Output** (works with any SIEM):
```yaml
output:
  format: "json"          # Universal format
  destination: "file"     # File monitoring (most compatible)
  file:
    path: "/var/log/siem/logs.json"
```

**Direct HTTP Integration**:
```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "https://your-siem.com/api/events"
    headers:
      "Authorization": "Bearer your-token"
```

**Syslog Integration**:
```yaml
output:
  format: "syslog"
  destination: "syslog"
  syslog:
    host: "siem-server.com"
    port: 514
```

## Output Formats

### JSON Format (Recommended for SIEM)
Universal format compatible with all SIEM systems:
```json
{
  "timestamp": "2025-09-04T10:30:00.000Z",
  "level": "WARN",
  "source": {
    "type": "firewall",
    "name": "pfsense-fw",
    "host": "firewall-01"
  },
  "message": "DROP TCP 192.168.1.100 -> 10.0.0.5 - Rule: 403",
  "metadata": {
    "environment": "production",
    "correlationId": "uuid-here"
  }
}
```

### Wazuh Format
Optimized for Wazuh ingestion with proper agent and rule mapping:
```json
{
  "timestamp": "2023-12-01T10:30:00Z",
  "agent": {"name": "log-generator", "id": "001"},
  "rule": {"level": 3, "description": "HTTP GET /api/users - 200 150ms"},
  "data": {"method": "GET", "status": 200}
}
```

### Syslog Format
Standard syslog format for traditional SIEM systems:
```
<134>Dec 01 10:30:00 api.example.com nginx[main]: HTTP GET /api/users - 200 150ms
```

### CEF Format
Common Event Format for security tools:
```
CEF:0|LogGenerator|LogGen|1.0|ENDPOINT|HTTP GET /api/users - 200 150ms|3|method=GET status=200
```

## Replay System

The replay system allows you to:

- Replay historical logs at different speeds (0.1x to 100x)
- Filter logs by source, level, or time range
- Loop replay continuously
- Maintain original timing relationships between logs

### Example Replay Scenarios

1. **Security Incident Investigation**: Replay logs from a specific time period to analyze attack patterns
2. **SIEM Testing**: Generate consistent log streams for testing detection rules
3. **Load Testing**: Replay logs at high speed to test log processing capacity
4. **Training**: Create reproducible scenarios for security training

## Docker Deployment

### Standalone Deployment
```bash
docker build -t log-generator .
docker run -d --name log-generator \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  log-generator
```

### With Wazuh Stack
```bash
# Start complete stack
docker-compose up -d

# View logs
docker-compose logs -f log-generator

# Stop services
docker-compose down
```

## Integration with Wazuh

### File-based Integration
1. Configure output to write to a file that Wazuh monitors:
   ```yaml
   output:
     format: "wazuh"
     destination: "file"
     file:
       path: "/var/ossec/logs/log-generator.json"
   ```

2. Add to Wazuh configuration (`/var/ossec/etc/ossec.conf`):
   ```xml
   <localfile>
     <log_format>json</log_format>
     <location>/var/ossec/logs/log-generator.json</location>
   </localfile>
   ```

### Syslog Integration
1. Configure syslog output:
   ```yaml
   output:
     format: "syslog"
     destination: "syslog"
     syslog:
       host: "wazuh-manager"
       port: 514
       protocol: "udp"
   ```

### HTTP API Integration
1. Configure HTTP output:
   ```yaml
   output:
     format: "wazuh"
     destination: "http"
     http:
       url: "https://wazuh-manager:55000/api/events"
       headers:
         Authorization: "Bearer your-token"
   ```

## Monitoring and Maintenance

### Log Rotation
- Automatic daily rotation at 1 AM
- Configurable file size limits
- Historical log retention (default: 30 days)

### Health Monitoring
- Built-in health checks
- Generator status monitoring
- Replay progress tracking

### Performance Tuning
- Adjust frequency per generator
- Configure batch sizes for output
- Optimize template complexity

## Development

### Project Structure
```
src/
├── generators/          # Log generators for different sources
├── replay/             # Historical log replay system
├── utils/              # Utilities (formatters, storage, etc.)
├── config/             # Configuration management
├── types/              # TypeScript type definitions
├── cli.ts              # Command-line interface
└── index.ts            # Main application entry point
```

### Adding New Log Sources
1. Extend the `BaseGenerator` class
2. Define source-specific templates
3. Register in `LogGeneratorManager`
4. Update configuration schema

### Custom Output Formats
1. Add formatter to `LogFormatters` class
2. Update configuration options
3. Implement in `OutputManager`

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure log directories are writable
2. **Port Conflicts**: Check if ports 514 (syslog) or 55000 (Wazuh API) are available
3. **Memory Usage**: Reduce log frequency or batch sizes for high-volume scenarios
4. **Disk Space**: Monitor log storage and adjust retention policies

### Debug Mode
Enable debug logging:
```bash
DEBUG=log-generator:* npm start
```

### Log Analysis
Check generated logs for format correctness:
```bash
# View recent logs
tail -f logs/current/logs.json

# Validate JSON format
cat logs/current/logs.json | jq .

# Count logs by level
cat logs/current/logs.json | jq -r '.level' | sort | uniq -c
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🐛 Bug Reports
- Use GitHub Issues to report bugs
- Include detailed reproduction steps
- Provide system information (OS, Node.js version)
- Attach relevant log files

### 💡 Feature Requests  
- Open a GitHub Issue with the "enhancement" label
- Describe the use case and expected behavior
- Consider contributing the implementation

### 🔧 Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/log-generator.git
cd log-generator

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

### 📝 Code Guidelines
- Follow TypeScript best practices
- Add tests for new features
- Update documentation for changes
- Use conventional commit messages

## 📄 License

**GNU General Public License v3.0**

This project is licensed under GPL-3.0 to ensure it remains free and open source:

- ✅ **Free to use** for personal, educational, and research purposes
- ✅ **Free to modify** and distribute under the same license
- ✅ **Free to contribute** improvements back to the community
- ❌ **Commercial use prohibited** without explicit permission

See the [LICENSE](LICENSE) file for full terms.

### Why GPL-3.0?
We chose GPL-3.0 to prevent commercial exploitation while encouraging community collaboration. This ensures the tool remains freely available for cybersecurity professionals, researchers, and students.

## 📚 Complete Documentation

### 📖 User Guides
| Guide | Purpose | Target Audience |
|-------|---------|-----------------|
| **[📋 Log Types Reference](LOG_TYPES_REFERENCE.md)** | **Detailed breakdown of all 12 log types with examples** | **All users - start here!** |
| **[Configuration Guide](CONFIGURATION.md)** | Customize log rates, create presets, advanced settings | All users who need custom configurations |
| **[SIEM Integration](SIEM_INTEGRATION.md)** | Connect to Splunk, Elastic, QRadar, ArcSight, etc. | SIEM administrators, security teams |
| **[🔧 SIEM Technical Guide](SIEM_TECHNICAL_GUIDE.md)** | **How integration works under the hood, troubleshooting** | **Developers, advanced users** |
| **[System Requirements](SYSTEM_REQUIREMENTS.md)** | Hardware sizing, performance benchmarks, capacity planning | Infrastructure teams, DevOps |

### 🔬 Technical Documentation
| Document | Purpose | Target Audience |
|----------|---------|-----------------|
| **[Technical Analysis](LOG_ANALYSIS.md)** | Deep-dive system architecture, replay analysis, testing results | Developers, technical users, contributors |

### 📁 Configuration Files
| File | Purpose |
|------|---------|
| **[Default Config](src/config/default.yaml)** | Sample configuration with all options |
| **[Docker Compose](docker-compose.yml)** | Container deployment setup |

## 🆘 Support & Community

### 📚 Quick Links

### 💬 Getting Help
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/summved/log-generator/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/summved/log-generator/discussions)  
- 📧 **Security Issues**: Email maintainers privately
- 📖 **Documentation**: Check existing examples and analysis files

### 🔍 Troubleshooting
```bash
# Verify installation
./scripts/test-install.sh

# Check system status
npx ts-node src/cli.ts status

# View detailed logs
tail -f logs/combined.log

# Validate configuration
npx ts-node src/cli.ts config --validate
```

## 🌟 Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/) and [Node.js](https://nodejs.org/)
- Inspired by real-world SIEM testing needs
- Thanks to the cybersecurity community for feedback and contributions

---

**⭐ Star this repository if you find it useful!**
**🔄 Share with your security team and colleagues**
