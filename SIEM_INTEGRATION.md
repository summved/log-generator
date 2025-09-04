# 🛡️ SIEM Integration Guide

## Overview

The log generator supports **multiple output formats and destinations** with **12 comprehensive log source types**, making it compatible with virtually any SIEM system. You can send logs directly to your SIEM via various methods.

### 🆕 **Enhanced Coverage (12 Source Types)**
- **🏗️ Infrastructure**: Endpoint, Application, Server, Firewall, Cloud
- **🔐 Security**: Authentication, Web Server  
- **💾 Data**: Database, Backup
- **🚀 Modern**: Microservices, Email, IoT

**Total Rate**: 238 logs/min (14,280 logs/hour) providing comprehensive enterprise coverage.

## 📤 Supported Output Methods

### 1. 📁 **File-Based Integration** (Most Compatible)
Write logs to files that your SIEM monitors:

```yaml
output:
  format: "json"           # Generic JSON format
  destination: "file"
  file:
    path: "/var/log/siem/generated-logs.json"
    rotation: true
    maxSize: "100MB"
    maxFiles: 10
```

**Compatible with:** All SIEM systems (Splunk, QRadar, ArcSight, Elastic, etc.)

### 2. 🌐 **HTTP/REST API Integration**
Send logs directly to SIEM REST endpoints:

```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "https://your-siem.com/api/events"
    headers:
      "Content-Type": "application/json"
      "Authorization": "Bearer your-api-token"
      "X-Source": "log-generator"
```

### 3. 📡 **Syslog Integration**
Traditional syslog forwarding:

```yaml
output:
  format: "syslog"
  destination: "syslog"
  syslog:
    host: "siem-server.company.com"
    port: 514
    protocol: "udp"    # or "tcp"
```

### 4. 🖥️ **Stdout/Pipeline Integration**
Pipe logs to other systems:

```yaml
output:
  format: "json"
  destination: "stdout"
```

```bash
# Pipe to any system
npm run generate | your-log-forwarder
npm run generate | curl -X POST https://siem.com/api -d @-
```

## 🎯 SIEM-Specific Configurations

### 🔵 **Splunk Integration**

#### Method 1: File Monitoring
```yaml
output:
  format: "json"
  destination: "file"
  file:
    path: "/opt/splunk/var/spool/splunk/generated-logs.json"
```

#### Method 2: HTTP Event Collector (HEC)
```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "https://splunk.company.com:8088/services/collector/event"
    headers:
      "Authorization": "Splunk your-hec-token"
      "Content-Type": "application/json"
```

### 🟢 **Elastic Stack (ELK) Integration**

#### Method 1: Filebeat Monitoring
```yaml
output:
  format: "json"
  destination: "file"
  file:
    path: "/var/log/generated/logs.json"
```

#### Method 2: Direct to Elasticsearch
```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "https://elasticsearch.company.com:9200/logs/_doc"
    headers:
      "Content-Type": "application/json"
      "Authorization": "Basic base64-credentials"
```

### 🟡 **QRadar Integration**

#### Syslog Method
```yaml
output:
  format: "syslog"
  destination: "syslog"
  syslog:
    host: "qradar.company.com"
    port: 514
    protocol: "udp"
```

#### File Method
```yaml
output:
  format: "json"
  destination: "file"
  file:
    path: "/store/configservices/staging/events/generated-logs.json"
```

### 🔴 **ArcSight Integration**

#### CEF Format (Recommended)
```yaml
output:
  format: "cef"
  destination: "syslog"
  syslog:
    host: "arcsight.company.com"
    port: 514
    protocol: "tcp"
```

### 🟠 **Wazuh Integration** (Already Optimized)

```yaml
output:
  format: "wazuh"
  destination: "file"
  file:
    path: "/var/ossec/logs/log-generator.json"
```

### 🟣 **Microsoft Sentinel Integration**

#### Log Analytics Workspace
```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "https://your-workspace.ods.opinsights.azure.com/api/logs?api-version=2016-04-01"
    headers:
      "Content-Type": "application/json"
      "Log-Type": "GeneratedLogs"
      "Authorization": "SharedKey workspace-id:shared-key"
```

## 📋 Generic JSON Format

The **JSON format** is the most universal and SIEM-friendly:

### Sample JSON Output
```json
{
  "timestamp": "2025-09-04T10:30:00.000Z",
  "level": "WARN",
  "source": {
    "type": "firewall",
    "name": "pfsense-fw",
    "host": "firewall-01",
    "component": "packet-filter"
  },
  "message": "DROP TCP 192.168.1.100:45123 -> 10.0.0.5:22 - Rule: 403",
  "metadata": {
    "environment": "production",
    "version": "1.0.0",
    "correlationId": "uuid-here",
    "generator": "log-generator"
  }
}
```

### JSON Schema Benefits
- ✅ **Universal compatibility** with all SIEM systems
- ✅ **Structured data** for easy parsing and analysis
- ✅ **Consistent format** across all log sources
- ✅ **Rich metadata** for correlation and filtering
- ✅ **Easy to extend** with custom fields

## 🚀 Quick Setup Examples

### Example 1: Generic SIEM with JSON File Monitoring

```bash
# Create config for generic SIEM
cat > siem-config.yaml << EOF
generators:
  endpoint:
    frequency: 20
  application:
    frequency: 15
  server:
    frequency: 10
  firewall:
    frequency: 30
  cloud:
    frequency: 10

output:
  format: "json"
  destination: "file"
  file:
    path: "/var/log/siem/security-logs.json"
    rotation: true
    maxSize: "50MB"
    maxFiles: 20
EOF

# Run with generic SIEM config
npm run generate -- --config siem-config.yaml
```

### Example 2: High-Volume JSON for Load Testing

```bash
# Create high-volume config
cat > load-test-config.yaml << EOF
generators:
  endpoint:
    frequency: 200
  application:
    frequency: 150
  server:
    frequency: 100
  firewall:
    frequency: 300
  cloud:
    frequency: 50

output:
  format: "json"
  destination: "file"
  file:
    path: "/tmp/load-test-logs.json"
    rotation: false
EOF

# Generate high volume for SIEM load testing
npm run generate -- --config load-test-config.yaml
```

### Example 3: Multi-SIEM Output (Advanced)

You can run multiple instances for different SIEMs:

```bash
# Terminal 1: JSON for Splunk
npm run generate -- --config splunk-config.yaml

# Terminal 2: CEF for ArcSight  
npm run generate -- --config arcsight-config.yaml

# Terminal 3: Syslog for QRadar
npm run generate -- --config qradar-config.yaml
```

## 🔧 Advanced SIEM Integration

### Custom JSON Fields

You can modify the JSON structure by editing the formatters:

```typescript
// In src/utils/formatters.ts
public static formatAsJSON(entry: LogEntry): string {
  const customFormat = {
    "@timestamp": entry.timestamp,
    "event_type": entry.source.type,
    "severity": entry.level,
    "message": entry.message,
    "source_ip": "192.168.1.100", // Add custom fields
    "destination_ip": "10.0.0.5",
    "custom_field": "your-value",
    ...entry.metadata
  };
  return JSON.stringify(customFormat);
}
```

### Batch Processing

For high-volume SIEM ingestion:

```yaml
output:
  format: "json"
  destination: "file"
  file:
    path: "/var/log/siem/batch-logs.json"
    rotation: true
    maxSize: "10MB"    # Smaller files for faster processing
    maxFiles: 100      # More files for parallel processing
```

## 📊 SIEM Integration Testing

### Test SIEM Connectivity

```bash
# Test HTTP endpoint
curl -X POST https://your-siem.com/api/test \
  -H "Content-Type: application/json" \
  -d '{"test": "connectivity"}'

# Test syslog connectivity
echo "test message" | nc -u siem-server.com 514

# Test file permissions
touch /var/log/siem/test.json && rm /var/log/siem/test.json
```

### Monitor Integration

```bash
# Monitor log generation
tail -f /var/log/siem/generated-logs.json

# Check generation rate
watch 'wc -l /var/log/siem/generated-logs.json'

# Verify SIEM ingestion
# (Check your SIEM's interface for incoming logs)
```

## 🎯 Best Practices for SIEM Integration

1. **Start with JSON format** - Most universal and flexible
2. **Use file monitoring** - Most reliable for initial setup  
3. **Test connectivity** - Verify endpoints before high-volume generation
4. **Monitor disk space** - Set appropriate rotation policies
5. **Use consistent timestamps** - Ensure proper log correlation
6. **Add correlation IDs** - Help with log tracing and analysis
7. **Configure appropriate rates** - Match your SIEM's ingestion capacity
8. **Test parsing rules** - Verify your SIEM correctly parses the logs

## 🔍 Troubleshooting SIEM Integration

### Common Issues

1. **Permission denied**: Ensure write permissions to log directories
2. **Network connectivity**: Test syslog/HTTP endpoints
3. **Format parsing**: Verify SIEM understands the log format
4. **Rate limiting**: Reduce generation rate if SIEM can't keep up
5. **Disk space**: Monitor storage usage with log rotation

### Debug Commands

```bash
# Check log format
head -5 /var/log/siem/generated-logs.json | jq .

# Verify network connectivity
telnet siem-server.com 514

# Monitor system resources
htop
df -h
```

---

**Your log generator is already SIEM-ready!** 🛡️ The JSON format provides maximum compatibility with any SIEM system.
