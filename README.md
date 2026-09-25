# 🚀 Enterprise SIEM Log Generator

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**The most comprehensive open-source cybersecurity log generator** for SIEM testing, security training, and threat simulation. Generate realistic enterprise logs with **MITRE ATT&CK framework integration**, **D3FEND defensive techniques**, **ML-based behavioral patterns**, **attack chain simulation**, and **high-performance worker threads**.

Perfect for **SOC analysts**, **penetration testers**, **security researchers**, and **cybersecurity educators** who need realistic log data for testing SIEM rules, training detection capabilities, and simulating real-world attack scenarios.

## 🎯 Key Features

- **🎯 MITRE ATT&CK Integration** - Generate logs mapped to specific techniques and tactics
- **🛡️ D3FEND Defensive Framework** - Generate defensive response logs and SOC activities  
- **🔗 Attack Chain Simulation** - Execute multi-stage scenarios (APT29, Ransomware, Insider Threats)
- **🤖 AI-Enhanced Attack Chains** - Dynamic, evolving attack scenarios with local AI (NO external APIs)
- **🧠 ML-Based Pattern Learning** - Generate realistic, behavior-based logs using machine learning
- **⚡ High-Performance Generation** - 6,000+ logs/second native, up to 20,000+ with worker threads and memory-first approach
- **📊 Real-time Monitoring** - Built-in Prometheus metrics, Grafana dashboards, and health endpoints
- **🌐 SIEM Integration** - Direct integration with Splunk, ELK, Wazuh, QRadar via HTTP/Syslog (tested and verified)
- **🐳 Docker & Kubernetes Ready** - Production-ready containers with complete monitoring stack
- **🔄 Historical Replay** - Replay and analyze existing log data with advanced filtering
- **📊 12+ Log Sources** - Endpoint, Application, Server, Firewall, Cloud, Authentication, Database, and more

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/your-username/log-generator.git
cd log-generator
npm install
```

### Basic Usage
```bash
# Generate logs (stored in logs/current/ folder with monitoring)
npm run generate

# Generate for specific duration
npm run generate -- --duration 30m

# Generate MITRE ATT&CK specific logs
npm run generate -- --mitre-technique T1110 --duration 1h

# Run attack chain simulation
npm run attack-chains:execute apt29-cozy-bear

# NEW: AI-Enhanced Attack Chains
npm run attack-chains:execute-ai ransomware-ryuk --mode enhanced --ai-level medium
npm run attack-chains:training apt29-cozy-bear --variations 5 --progressive

# High-performance generation with worker threads
npm run performance-test -- --mode worker --workers 4 --duration 30s

# Test SIEM integrations
npm run performance-test -- --mode http --duration 10s
npm run performance-test -- --mode syslog --duration 10s

# Validate configuration (advisory warnings)
npm run validate-config

# Check status and performance
npm run status

# Access monitoring endpoints (when generator is running with monitoring enabled)
curl http://localhost:3000/health     # Health check
curl http://localhost:3000/metrics    # Prometheus metrics
curl http://localhost:3000/status     # Detailed status

# Disable monitoring if not needed (optional)
ENABLE_MONITORING=false npm run generate
```

### Log Storage
All logs are automatically stored in the `logs/current/` folder in JSON format by default. Historical logs are rotated to `logs/historical/` for long-term storage and analysis.

## 🐳 Docker & Monitoring Stack

### Quick Docker Setup
```bash
# Start complete monitoring stack (Prometheus + Grafana + SIEM testing)
SIEM_HTTP_URL="http://localhost:8000/post" \
SIEM_API_TOKEN="test-token" \
GRAFANA_PASSWORD="admin123" \
docker-compose -f docker-compose.production.yml up -d

# Access monitoring dashboards
# Grafana: http://localhost:3001 (admin/admin123)
# Prometheus: http://localhost:9090
# SIEM Test Endpoint: http://localhost:8000/post (POST requests)
# Log Generator Metrics: http://localhost:3000/metrics
```

### Production Kubernetes Deployment
```bash
# Deploy to Kubernetes with auto-scaling
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n log-generator
kubectl get services -n log-generator
```

## 📋 Available Commands

| **Category** | **Command** | **Description** |
|---|---|---|
| **Generation** | `npm run generate` | Generate logs from all configured sources |
| **Performance** | `npm run performance-test` | High-performance testing with worker threads |
| **MITRE ATT&CK** | `npm run mitre-list` | List supported MITRE techniques |
| **Attack Chains** | `npm run attack-chains:list` | List available attack scenarios |
| **AI Attack Chains** | `npm run attack-chains:execute-ai <name>` | Execute with AI enhancements |
| **AI Training** | `npm run attack-chains:training <name>` | Run progressive AI training sessions |
| **ML Patterns** | `npm run ml-patterns:learn <files>` | Learn from historical data |
| **SOC Simulation** | `npm run soc-simulation:scenarios` | List SOC simulation scenarios |
| **Replay** | `npm run replay` | Replay historical logs |
| **Analysis** | `npm run analyze` | Analyze log files for issues |
| **Configuration** | `npm run validate-config` | Validate configuration files (advisory warnings) |
| **Status** | `npm run status` | Show current system status and performance |
| **Monitoring** | `curl localhost:3000/health` | Health check endpoint (optional) |
| **Monitoring** | `curl localhost:3000/metrics` | Prometheus metrics endpoint (optional) |
| **Monitoring** | `ENABLE_MONITORING=false npm run generate` | Disable monitoring features |

For a complete list of commands, run: `npx ts-node src/cli.ts --help`

## 🛡️ SIEM Integration

The log generator supports multiple output formats and destinations:

**Output Formats:**
- **JSON** - Default format, stored in `logs/current/`
- **Syslog** - RFC3164/5424 compliant
- **CEF** - Common Event Format
- **HTTP** - Direct SIEM integration via REST API

**Supported SIEMs:**
- Splunk (HTTP Event Collector)
- Elastic/ELK Stack
- Wazuh
- QRadar
- Sentinel
- Any syslog-compatible SIEM

See **[SIEM_INTEGRATION.md](SIEM_INTEGRATION.md)** for detailed integration guides.

## ⚡ High-Performance Features

- **Worker Threads** - Parallel log generation across multiple CPU cores
- **Memory-First Approach** - 10,000 log buffer before disk writes
- **Network Output** - Direct HTTP/Syslog streaming to SIEM (10-50x faster than disk)
- **Batch Processing** - Configurable batch sizes for optimal performance
- **Real-time Monitoring** - Performance statistics and system health monitoring

Expected performance: **5,000-20,000+ logs/second** with proper configuration.

## 📚 Documentation

| **Guide** | **Description** | **Audience** |
|---|---|---|
| **[🛠️ System Setup](SYSTEM_SETUP.md)** | Platform-specific setup and requirements | All users |
| **[❓ FAQ](FAQ.md)** | Frequently asked questions | All users |
| **[🎯 Use Cases](USE_CASES.md)** | Role-specific implementation guides | SOC, Red Team, Educators |
| **[📋 Log Types Reference](LOG_TYPES_REFERENCE.md)** | Complete breakdown of all log sources | Technical users |
| **[⚙️ Configuration Guide](CONFIGURATION.md)** | Detailed configuration options | Advanced users |
| **[🛡️ SIEM Integration](SIEM_INTEGRATION.md)** | Integration with major SIEM platforms | SIEM administrators |
| **[🔧 Technical Guide](SIEM_TECHNICAL_GUIDE.md)** | Advanced usage and troubleshooting | DevOps, Engineers |
| **[🚀 Performance Guide](PERFORMANCE_GUIDE.md)** | Performance optimization and benchmarking | Performance engineers |
| **[📈 Log Analysis](LOG_ANALYSIS.md)** | Analysis tools and quality metrics | Security analysts |
| **[🏗️ Code Architecture](CODE_ARCHITECTURE.md)** | Developer documentation and API reference | Developers |
| **[🔧 Advanced Features](ADVANCED_FEATURES.md)** | ML patterns, attack chains, D3FEND integration | Advanced users |

## 🎯 Use Cases

- **🔒 Security Testing** - Test SIEM rules and detection capabilities
- **📚 Training & Education** - Cybersecurity training with realistic scenarios  
- **🧪 Development** - Generate consistent test data for applications
- **⚡ Performance Testing** - Load test log ingestion systems with high-volume generation
- **🎭 Incident Simulation** - Recreate attack scenarios for analysis
- **🔄 Continuous Testing** - Automated testing in CI/CD pipelines

## 🔧 System Requirements

- **Node.js** 22.12.0 or higher
- **Memory** 4GB+ RAM (8GB+ recommended for high-performance mode)
- **Storage** SSD recommended for high-volume generation
- **Network** For SIEM integration via HTTP/Syslog

See **[SYSTEM_REQUIREMENTS.md](SYSTEM_REQUIREMENTS.md)** for detailed specifications.

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
- **MITRE D3FEND Framework** - For the defensive cybersecurity ontology
- **Security Research Community** - For attack pattern validation

---

**⭐ Star this repository if it helps with your security testing and SIEM development!**