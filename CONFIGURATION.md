# 🔧 Configuration Guide

## ⚡ Customizing Log Generation Rates

The log generator is **fully configurable** - you can easily adjust the number of logs per minute for each source type to match your testing needs.

## 📊 Default Configuration

### 🏗️ Core Infrastructure Sources (65 logs/min)
| Source Type | Default Rate | Description |
|-------------|--------------|-------------|
| **Endpoint** | 10 logs/min | API Gateway, HTTP requests, rate limiting |
| **Application** | 15 logs/min | Business logic, database operations, cache |
| **Server** | 8 logs/min | System metrics, service management |
| **Firewall** | 20 logs/min | Packet filtering, intrusion detection |
| **Cloud** | 12 logs/min | AWS CloudTrail, auto-scaling, Lambda |

### 🔐 Security & Identity Sources (40 logs/min)
| Source Type | Default Rate | Description |
|-------------|--------------|-------------|
| **Authentication** | 25 logs/min | Login/logout, failed attempts, account lockouts |
| **Web Server** | 15 logs/min | Access logs, SSL certificates, rate limiting |

### 💾 Data & Storage Sources (38 logs/min)
| Source Type | Default Rate | Description |
|-------------|--------------|-------------|
| **Database** | 30 logs/min | Query execution, transactions, deadlocks |
| **Backup** | 8 logs/min | Backup operations, storage monitoring |

### 🚀 Modern Architecture Sources (95 logs/min)
| Source Type | Default Rate | Description |
|-------------|--------------|-------------|
| **Microservices** | 35 logs/min | Service calls, circuit breakers, scaling |
| **Email** | 15 logs/min | SMTP operations, delivery status, spam |
| **IoT** | 20 logs/min | Device connectivity, sensor data, firmware |

**Total Default:** 238 logs/min (14,280 logs/hour) - **All 12 Sources Active!**

## 🛠️ How to Customize Rates

### Method 1: Edit Default Configuration

```bash
# Open the default config file
nano src/config/default.yaml

# Modify the frequency values:
generators:
  endpoint:
    enabled: true
    frequency: 50    # Change from 10 to 50 logs/min
  application:
    frequency: 5     # Change from 15 to 5 logs/min
  firewall:
    enabled: false   # Disable firewall logs completely
```

### Method 2: Create Custom Configuration

```bash
# Create your own config file
npx ts-node src/cli.ts init --output my-config.yaml

# Edit with your preferred rates
nano my-config.yaml

# Run with custom config
npm run generate -- --config my-config.yaml
```

## 🎯 Common Configuration Scenarios

### 🏠 **Light Development** (30 logs/min)
Perfect for development and debugging - only core infrastructure:
```yaml
generators:
  # Core infrastructure only
  endpoint:
    frequency: 10
  application:
    frequency: 8
  server:
    frequency: 5
  firewall:
    frequency: 5
  cloud:
    frequency: 2
  
  # Disable additional sources for light testing
  authentication:
    enabled: false
  database:
    enabled: false
  webserver:
    enabled: false
  email:
    enabled: false
  backup:
    enabled: false
  microservices:
    enabled: false
  iot:
    enabled: false
```

### 🏢 **Enterprise Simulation** (800+ logs/min)
Simulate busy enterprise environment with all systems active:
```yaml
generators:
  # Core infrastructure (heavy load)
  endpoint:
    frequency: 80    # Busy API gateway
  application:
    frequency: 60    # Active business apps
  server:
    frequency: 40    # Heavy monitoring
  firewall:
    frequency: 100   # Active security filtering
  cloud:
    frequency: 30    # Cloud activity
  
  # Security & identity
  authentication:
    frequency: 120   # High login activity
  webserver:
    frequency: 150   # Heavy web traffic
  
  # Data & storage
  database:
    frequency: 180   # Heavy database load
  backup:
    frequency: 20    # Regular backup operations
  
  # Modern architecture
  microservices:
    frequency: 200   # Active service mesh
  email:
    frequency: 80    # Email system activity
  iot:
    frequency: 60    # IoT device communications
```

### 🚨 **Security Incident Simulation** (400+ logs/min)
Focus on security events across all security-related sources:
```yaml
generators:
  # Core infrastructure (moderate)
  endpoint:
    frequency: 40    # API under attack
  application:
    frequency: 30    # Application alerts
  server:
    frequency: 25    # System stress
  firewall:
    frequency: 120   # Heavy attack simulation
  cloud:
    frequency: 15    # Cloud security events
  
  # Security sources (high activity)
  authentication:
    frequency: 80    # Brute force attacks
  webserver:
    frequency: 60    # Web attacks, DDoS
  
  # Data sources (monitoring attacks)
  database:
    frequency: 50    # SQL injection attempts
  backup:
    frequency: 5     # Backup integrity checks
  
  # Modern architecture (under attack)
  microservices:
    frequency: 40    # Service disruption
  email:
    frequency: 25    # Phishing campaigns
  iot:
    frequency: 15    # IoT botnet activity
```

### 🧪 **Tested Configuration: Selective Sources**
Based on actual testing - only enable specific source types:
```yaml
generators:
  # ENABLED sources (tested working)
  endpoint:
    enabled: true
    frequency: 20    # Increased rate
  application:
    enabled: true
    frequency: 25    # Increased rate
  authentication:
    enabled: true
    frequency: 30    # High auth activity
  firewall:
    enabled: true
    frequency: 15    # Moderate security
  database:
    enabled: true
    frequency: 40    # High DB activity
  microservices:
    enabled: true
    frequency: 50    # High service activity
  
  # DISABLED sources (for focused testing)
  server:
    enabled: false
  cloud:
    enabled: false
  webserver:
    enabled: false
  email:
    enabled: false
  backup:
    enabled: false
  iot:
    enabled: false
    
# Result: ~180 logs/min from 6 sources (tested working)
```

### ⚡ **Load Testing** (1000+ logs/min)
Stress test your SIEM:
```yaml
generators:
  endpoint:
    frequency: 300
  application:
    frequency: 250
  server:
    frequency: 200
  firewall:
    frequency: 200
  cloud:
    frequency: 100
```

## 📈 Performance Guidelines

### Recommended Rates by Use Case

| Use Case | Total Rate | Best For |
|----------|------------|----------|
| **Development** | 10-50 logs/min | Debugging, following individual logs |
| **Training** | 50-100 logs/min | Educational scenarios, manageable volume |
| **SIEM Testing** | 100-300 logs/min | Rule validation, detection testing |
| **Load Testing** | 300-1000+ logs/min | Performance testing, capacity planning |
| **Background Testing** | 20-100 logs/min | Long-running continuous scenarios |

### ⚠️ Performance Considerations

- **1-10 logs/min**: Minimal resources, great for detailed analysis
- **10-100 logs/min**: Balanced performance, suitable for most use cases
- **100-500 logs/min**: Higher CPU/memory usage, good for load testing
- **500+ logs/min**: Resource intensive, monitor system performance

## 🔧 Advanced Configuration

### Selective Source Testing

Enable only specific sources for focused testing:

```yaml
# Test only security events
generators:
  endpoint:
    enabled: false
  application:
    enabled: false  
  server:
    enabled: false
  firewall:
    enabled: true
    frequency: 100    # Focus on firewall logs
  cloud:
    enabled: true
    frequency: 50     # With some cloud events
```

### Environment-Specific Configs

Create different configurations for different environments:

```bash
# Development environment
cp src/config/default.yaml config-dev.yaml
# Edit frequencies to 1-5 logs/min each

# Staging environment  
cp src/config/default.yaml config-staging.yaml
# Edit frequencies to 20-50 logs/min each

# Production testing
cp src/config/default.yaml config-prod.yaml
# Edit frequencies to 100-200 logs/min each

# Use specific config
npm run generate -- --config config-prod.yaml
```

### Template Customization

Each source type has multiple log templates with probability weights:

```yaml
generators:
  endpoint:
    frequency: 20
    templates:
      - level: INFO
        messageTemplate: "HTTP {method} {path} - {status} {responseTime}ms"
        probability: 0.6    # 60% of logs will be INFO level
      - level: ERROR
        messageTemplate: "HTTP {method} {path} - {status} {errorMessage}"
        probability: 0.1    # 10% will be ERROR level
      - level: WARN
        messageTemplate: "Rate limit exceeded for IP {clientIP}"
        probability: 0.05   # 5% will be WARN level
```

## 📊 Monitoring Your Configuration

### Real-time Monitoring

```bash
# Watch logs being generated
tail -f logs/current/logs.json

# Monitor generation rate
watch 'tail -100 logs/current/logs.json | wc -l'

# Check system status
npx ts-node src/cli.ts status
```

### Validate Configuration

```bash
# Verify your config is valid
npx ts-node src/cli.ts config --config my-config.yaml --validate

# View current configuration
npx ts-node src/cli.ts config --show
```

## 🚀 Quick Start Examples

### Example 1: Create Light Config for Development

```bash
cat > light-config.yaml << EOF
generators:
  endpoint:
    enabled: true
    frequency: 2
  application:
    enabled: true
    frequency: 3
  server:
    enabled: true
    frequency: 1
  firewall:
    enabled: true
    frequency: 4
  cloud:
    enabled: false
output:
  format: "json"
  destination: "file"
  file:
    path: "./logs/current/logs.json"
EOF

# Run with light configuration (10 logs/min total)
npm run generate -- --config light-config.yaml
```

### Example 2: High-Volume Security Testing

```bash
cat > security-test.yaml << EOF
generators:
  endpoint:
    enabled: true
    frequency: 50
  application:
    enabled: true
    frequency: 30
  server:
    enabled: true
    frequency: 40
  firewall:
    enabled: true
    frequency: 200    # Heavy security focus
  cloud:
    enabled: true
    frequency: 80
output:
  format: "wazuh"
  destination: "file"
  file:
    path: "./logs/current/security-test.json"
EOF

# Run security-focused test (400 logs/min total)
npm run generate -- --config security-test.yaml
```

## 🎯 Best Practices

1. **Start Small**: Begin with low rates (10-50 logs/min) and increase gradually
2. **Monitor Resources**: Watch CPU and memory usage, especially at high rates
3. **Test Realistic Scenarios**: Match your actual environment's log volume patterns
4. **Save Configurations**: Keep tested configs for different scenarios
5. **Document Settings**: Note what rates work best for your specific use cases
6. **Validate Changes**: Always test configuration changes before production use

## 🔄 Dynamic Rate Adjustment

You can change rates without losing data by:

1. **Stopping** the current generator (Ctrl+C)
2. **Editing** your configuration file
3. **Restarting** with the updated config

```bash
# Stop current generation
# Edit your config file
nano my-config.yaml

# Restart with new rates
npm run generate -- --config my-config.yaml
```

## 📝 Configuration File Structure

Here's the complete structure of a configuration file:

```yaml
generators:
  endpoint:
    enabled: true|false
    frequency: number (logs per minute)
    templates: [array of log templates]
  application:
    enabled: true|false
    frequency: number
    templates: [array of log templates]
  server:
    enabled: true|false
    frequency: number
    templates: [array of log templates]
  firewall:
    enabled: true|false
    frequency: number
    templates: [array of log templates]
  cloud:
    enabled: true|false
    frequency: number
    templates: [array of log templates]

output:
  format: "json"|"syslog"|"cef"|"wazuh"
  destination: "file"|"syslog"|"http"|"stdout"
  file:
    path: string
    rotation: boolean
    maxSize: string
    maxFiles: number

storage:
  historicalPath: string
  currentPath: string
  retention: number (days)

replay:
  enabled: boolean
  speed: number
  loop: boolean
```

---

**Need more help?** Check the [main README](README.md) or create an issue on [GitHub](https://github.com/summved/log-generator/issues)!
