# 🔧 SIEM Integration Technical Guide

## 🎯 Overview

This guide explains **how SIEM integration actually works** under the hood, with step-by-step configuration and testing procedures. For quick SIEM setup, see [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md).

---

## 🔄 **How Integration Actually Works**

### **Key Insight: Real-Time vs Historical Storage**

```
Log Generator → OutputManager → SIEM Integration (REAL-TIME)
                            ↓
                    Also saves to /logs/current/ (HISTORICAL)
```

**❌ Common Misconception**: "SIEM picks up files from `/logs/current/`"  
**✅ Reality**: SIEM integration happens **in real-time** as logs are generated.

### **The Code Flow**
1. **Generator creates log** → `LogGeneratorManager.generateLog()`
2. **OutputManager.outputLog()** routes the log based on configuration
3. **Real-time delivery** to SIEM via configured method
4. **Always stores** to `/logs/current/` for historical purposes

---

## 📁 **1. File-Based Integration (Detailed)**

### **How It Works**
- Logs are written directly to a file that your SIEM monitors
- **NOT** picking up from `/logs/current/` - writes to specified path
- SIEM file monitoring agents watch the configured file

### **Step-by-Step Configuration**

1. **Edit Configuration** (`src/config/default.yaml`):
```yaml
output:
  format: "json"           # Choose: json, syslog, cef, wazuh
  destination: "file"      # Route to file output
  file:
    path: "/var/log/siem/generated-logs.json"  # Where SIEM reads from
    rotation: true
    maxSize: "100MB"
    maxFiles: 10
```

2. **Create Target Directory**:
```bash
sudo mkdir -p /var/log/siem
sudo chmod 755 /var/log/siem
```

3. **Start Log Generation**:
```bash
npm run generate
```

4. **Verify File Creation**:
```bash
tail -f /var/log/siem/generated-logs.json
```

### **SIEM-Specific File Configurations**

#### **Splunk Universal Forwarder**
```yaml
# Configuration
output:
  format: "json"
  destination: "file"
  file:
    path: "/opt/splunk/var/spool/splunk/generated-logs.json"
```

```bash
# Splunk inputs.conf
[monitor:///opt/splunk/var/spool/splunk/generated-logs.json]
sourcetype = json_logs
index = main
```

#### **Elastic Filebeat**
```yaml
# Configuration
output:
  format: "json"
  destination: "file"
  file:
    path: "/var/log/filebeat/generated-logs.json"
```

```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  paths:
    - /var/log/filebeat/generated-logs.json
  json.keys_under_root: true
```

#### **QRadar DSM**
```yaml
# Configuration
output:
  format: "syslog"  # QRadar prefers syslog format
  destination: "file"
  file:
    path: "/var/log/qradar/generated-logs.log"
```

### **Testing File Integration**
```bash
# 1. Set test configuration
cp test-integrations.yaml temp-config.yaml
# Edit temp-config.yaml with file_integration settings

# 2. Run short test
npm run generate -- --config temp-config.yaml &
sleep 30
pkill -f "npm run generate"

# 3. Check output
cat ./test-siem-output.json | head -5
```

---

## 🌐 **2. HTTP/REST API Integration (Detailed)**

### **How It Works**
- Each log is immediately sent via HTTP POST to SIEM API
- Uses `axios` library for HTTP requests
- Supports custom headers for authentication

### **Step-by-Step Configuration**

1. **Get SIEM API Details**:
   - API endpoint URL
   - Authentication token/key
   - Required headers
   - Rate limits

2. **Configure HTTP Output**:
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

3. **Test Connection**:
```bash
curl -X POST "https://your-siem.com/api/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-token" \
  -d '{"test": "connection"}'
```

### **SIEM-Specific HTTP Configurations**

#### **Splunk HTTP Event Collector (HEC)**
```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "https://splunk.company.com:8088/services/collector/event"
    headers:
      "Authorization": "Splunk YOUR-HEC-TOKEN"
      "Content-Type": "application/json"
```

**Setup HEC Token**:
```bash
# In Splunk Web UI:
# Settings → Data Inputs → HTTP Event Collector → New Token
# Copy the token and use in config above
```

#### **Elastic Stack (Logstash HTTP Input)**
```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "http://logstash.company.com:8080"
    headers:
      "Content-Type": "application/json"
```

**Logstash Configuration**:
```ruby
input {
  http {
    port => 8080
    codec => json
  }
}
```

#### **QRadar REST API**
```yaml
output:
  format: "json"
  destination: "http"
  http:
    url: "https://qradar.company.com/api/ariel/events"
    headers:
      "SEC": "your-sec-token"
      "Content-Type": "application/json"
      "Version": "12.0"
```

### **Testing HTTP Integration**
```bash
# 1. Test with httpbin.org (public test endpoint)
# Update config:
output:
  format: "json"
  destination: "http"
  http:
    url: "https://httpbin.org/post"
    headers:
      "Content-Type": "application/json"
      "X-Test": "log-generator"

# 2. Run test
npm run generate &
sleep 10
pkill -f "npm run generate"

# 3. Check httpbin.org to see received logs
```

---

## 📡 **3. Syslog Integration (Detailed)**

### **How It Works**
- Uses Node.js `dgram` module for UDP/TCP syslog
- Formats logs according to RFC 3164 or RFC 5424
- Sends directly to SIEM syslog receiver

### **Step-by-Step Configuration**

1. **Find SIEM Syslog Receiver**:
   - IP address or hostname
   - Port (usually 514 for UDP, 601 for TCP)
   - Protocol preference

2. **Configure Syslog Output**:
```yaml
output:
  format: "syslog"
  destination: "syslog"
  syslog:
    host: "siem-server.company.com"
    port: 514
    protocol: "udp"  # or "tcp"
```

3. **Test Network Connectivity**:
```bash
# Test UDP connectivity
nc -u siem-server.company.com 514

# Test TCP connectivity  
nc siem-server.company.com 601
```

### **SIEM-Specific Syslog Configurations**

#### **Splunk Syslog Input**
```yaml
# Generator config
output:
  format: "syslog"
  destination: "syslog"
  syslog:
    host: "splunk-indexer.company.com"
    port: 514
    protocol: "udp"
```

**Splunk inputs.conf**:
```ini
[udp://514]
sourcetype = syslog
index = main
```

#### **QRadar Syslog**
```yaml
# Generator config
output:
  format: "syslog"
  destination: "syslog"
  syslog:
    host: "qradar-console.company.com"
    port: 514
    protocol: "udp"
```

#### **ArcSight Syslog Connector**
```yaml
# Generator config
output:
  format: "cef"  # ArcSight prefers CEF format
  destination: "syslog"
  syslog:
    host: "arcsight-connector.company.com"
    port: 514
    protocol: "udp"
```

### **Testing Syslog Integration**
```bash
# 1. Test with local syslog
# Update config to use localhost:514

# 2. Monitor local syslog
sudo tail -f /var/log/syslog

# 3. Run generator
npm run generate &
sleep 10
pkill -f "npm run generate"

# 4. Check syslog for entries
```

---

## 🖥️ **4. Stdout/Pipeline Integration (Detailed)**

### **How It Works**
- Logs printed to stdout (console.log)
- Can be piped to any command-line tool
- Most flexible for custom integrations

### **Step-by-Step Configuration**

1. **Configure Stdout Output**:
```yaml
output:
  format: "json"  # Any format works
  destination: "stdout"
```

2. **Use with Pipes**:
```bash
# Pipe to file
npm run generate > /var/log/siem/logs.json

# Pipe to HTTP endpoint
npm run generate | curl -X POST https://siem.com/api -d @-

# Pipe to netcat (TCP)
npm run generate | nc siem-server.com 514

# Pipe to custom script
npm run generate | ./custom-siem-forwarder.sh
```

### **Advanced Pipeline Examples**

#### **Pipe to Splunk CLI**
```bash
npm run generate | /opt/splunk/bin/splunk add oneshot -sourcetype json_logs -index main -auth admin:password
```

#### **Pipe to Elastic Bulk API**
```bash
npm run generate | while read line; do
  echo '{"index":{"_index":"logs","_type":"_doc"}}'
  echo "$line"
done | curl -X POST "elasticsearch.com:9200/_bulk" -H "Content-Type: application/x-ndjson" -d @-
```

#### **Pipe to Kafka**
```bash
npm run generate | kafka-console-producer.sh --broker-list kafka.company.com:9092 --topic siem-logs
```

#### **Pipe with jq Processing**
```bash
# Transform JSON before sending
npm run generate | jq '.message = .message + " [PROCESSED]"' | curl -X POST https://siem.com/api -d @-
```

---

## 🧪 **Testing All Integration Methods**

### **Quick Test Script**
```bash
#!/bin/bash
# test-all-integrations.sh

echo "Testing File Integration..."
# Update config for file output
npm run generate -- --config test-file-config.yaml &
sleep 10
pkill -f "npm run generate"
echo "✓ File test complete - check test-output.json"

echo "Testing HTTP Integration..."  
# Update config for HTTP output
npm run generate -- --config test-http-config.yaml &
sleep 10
pkill -f "npm run generate"
echo "✓ HTTP test complete - check httpbin.org"

echo "Testing Stdout Integration..."
# Update config for stdout
echo "Generating 5 logs to stdout:"
timeout 5s npm run generate -- --config test-stdout-config.yaml

echo "✓ All integration tests complete"
```

### **Validation Checklist**
- [ ] **File**: Target file exists and contains JSON logs
- [ ] **HTTP**: SIEM API receives POST requests with log data
- [ ] **Syslog**: SIEM syslog receiver shows incoming messages
- [ ] **Stdout**: Console shows formatted log output
- [ ] **Historical**: `/logs/current/` always contains logs regardless of output method

---

## 🔧 **Code Deep Dive**

### **OutputManager Key Methods**

#### **outputLog() - Main Entry Point**
```typescript
public async outputLog(entry: LogEntry): Promise<void> {
  // 1. Format the log based on config.format
  const formattedLog = this.formatLog(entry);
  
  // 2. Route to destination
  switch (this.config.destination) {
    case 'file': await this.outputToFile(formattedLog); break;
    case 'http': await this.outputToHttp(formattedLog, entry); break;
    case 'syslog': await this.outputToSyslog(formattedLog); break;
    case 'stdout': console.log(formattedLog); break;
  }

  // 3. ALWAYS store locally for history
  await this.storageManager.storeLog(entry);
}
```

#### **Format Selection**
```typescript
private formatLog(entry: LogEntry): string {
  switch (this.config.format) {
    case 'json': return LogFormatters.formatAsJSON(entry);
    case 'syslog': return LogFormatters.formatAsSyslog(entry);
    case 'cef': return LogFormatters.formatAsCEF(entry);
    case 'wazuh': return LogFormatters.formatForWazuh(entry);
  }
}
```

### **Configuration Loading**
The config is loaded from `src/config/default.yaml` and can be overridden:
```bash
# Use default config
npm run generate

# Use custom config  
npm run generate -- --config custom-siem-config.yaml
```

---

## 🎯 **Best Practices**

### **Performance Optimization**
- **HTTP**: Use connection pooling for high-volume scenarios
- **File**: Enable rotation to prevent disk space issues  
- **Syslog**: Use TCP for guaranteed delivery, UDP for performance
- **Stdout**: Pipe to buffered tools for high throughput

### **Security Considerations**
- **HTTP**: Use HTTPS and proper authentication headers
- **File**: Set appropriate file permissions (644 or 600)
- **Syslog**: Use TLS encryption for sensitive logs
- **Network**: Ensure firewall rules allow SIEM communication

### **Monitoring Integration Health**
- **File**: Monitor file size and write permissions
- **HTTP**: Check for 200 responses and handle rate limiting
- **Syslog**: Verify network connectivity and port availability
- **General**: Monitor `/logs/current/` to ensure local storage works

---

## 🔍 **Troubleshooting**

### **Common Issues**

#### **File Integration**
```bash
# Permission denied
sudo chown $USER:$USER /var/log/siem/
sudo chmod 755 /var/log/siem/

# Disk space
df -h /var/log/siem/
```

#### **HTTP Integration**
```bash
# Test endpoint manually
curl -v -X POST "$SIEM_URL" -H "Content-Type: application/json" -d '{"test":true}'

# Check network connectivity
ping siem-hostname
telnet siem-hostname 8088
```

#### **Syslog Integration**
```bash
# Test UDP connectivity
nc -u siem-server.com 514

# Check if port is listening
nmap -p 514 siem-server.com
```

### **Debug Mode**
Enable debug logging to see integration details:
```bash
DEBUG=* npm run generate
```

---

## 📊 **Performance Benchmarks**

| Method | Throughput | Latency | Reliability | Best For |
|--------|------------|---------|-------------|----------|
| **File** | Very High | Low | High | High-volume, local SIEM |
| **HTTP** | Medium | Medium | Medium | Cloud SIEM, real-time |
| **Syslog** | High | Low | High | Traditional SIEM |
| **Stdout** | Very High | Very Low | High | Custom pipelines |

---

This technical guide provides the deep implementation details while keeping the main SIEM_INTEGRATION.md user-friendly and focused on quick setup.
