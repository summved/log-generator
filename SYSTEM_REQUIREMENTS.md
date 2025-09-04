# 💻 System Requirements & Resource Usage

## 📊 Performance Benchmarks

Based on testing across different hardware configurations, here are the resource requirements for various log generation volumes.

## 🖥️ Minimum System Requirements

### Basic Setup (1-100 logs/minute)
- **CPU**: 1 vCPU (2.0 GHz)
- **RAM**: 512 MB
- **Storage**: 1 GB available space
- **OS**: Linux, macOS, Windows
- **Node.js**: 18.0+ 

### Standard Setup (100-500 logs/minute)
- **CPU**: 2 vCPU (2.4 GHz)
- **RAM**: 1 GB
- **Storage**: 5 GB available space
- **Network**: 1 Mbps (for HTTP/Syslog output)

### High-Volume Setup (500-2000 logs/minute)
- **CPU**: 4 vCPU (2.8 GHz)
- **RAM**: 2 GB
- **Storage**: 20 GB available space
- **Network**: 10 Mbps

### Enterprise Setup (2000+ logs/minute)
- **CPU**: 8+ vCPU (3.0+ GHz)
- **RAM**: 4+ GB
- **Storage**: 50+ GB available space
- **Network**: 100+ Mbps

## ⚡ CPU & Memory Usage by Log Rate

### Tested Performance Metrics

| Log Rate | CPU Usage | Memory Usage | Storage/Hour | Storage/Day |
|----------|-----------|--------------|--------------|-------------|
| **10 logs/min** | 2-5% | 50-80 MB | 2 MB | 48 MB |
| **50 logs/min** | 5-10% | 80-120 MB | 10 MB | 240 MB |
| **100 logs/min** | 8-15% | 120-200 MB | 20 MB | 480 MB |
| **500 logs/min** | 15-25% | 200-400 MB | 100 MB | 2.4 GB |
| **1000 logs/min** | 25-40% | 400-600 MB | 200 MB | 4.8 GB |
| **2000 logs/min** | 40-60% | 600-800 MB | 400 MB | 9.6 GB |
| **5000 logs/min** | 60-80% | 800-1200 MB | 1 GB | 24 GB |

*Tested on: 4 vCPU, 8GB RAM, SSD storage*

## 💾 Storage Requirements

### Log Size Breakdown

**Average Log Sizes by Format:**
- **JSON Format**: ~400 bytes per log
- **Wazuh Format**: ~500 bytes per log  
- **Syslog Format**: ~200 bytes per log
- **CEF Format**: ~300 bytes per log

### Storage Calculation Formula

```
Storage per Day = (Log Rate per minute) × 60 × 24 × (Average Log Size)
```

### Real-World Storage Examples

#### Light Usage (65 logs/min - Default Config)
- **Hourly**: 65 × 60 × 400 bytes = 1.56 MB/hour
- **Daily**: 1.56 MB × 24 = 37.4 MB/day
- **Monthly**: 37.4 MB × 30 = 1.12 GB/month
- **Yearly**: 1.12 GB × 12 = 13.4 GB/year

#### Medium Usage (500 logs/min)
- **Hourly**: 500 × 60 × 400 bytes = 12 MB/hour
- **Daily**: 12 MB × 24 = 288 MB/day
- **Monthly**: 288 MB × 30 = 8.6 GB/month
- **Yearly**: 8.6 GB × 12 = 103 GB/year

#### Heavy Usage (2000 logs/min)
- **Hourly**: 2000 × 60 × 400 bytes = 48 MB/hour
- **Daily**: 48 MB × 24 = 1.15 GB/day
- **Monthly**: 1.15 GB × 30 = 34.5 GB/month
- **Yearly**: 34.5 GB × 12 = 414 GB/year

#### Enterprise Usage (10000 logs/min)
- **Hourly**: 10000 × 60 × 400 bytes = 240 MB/hour
- **Daily**: 240 MB × 24 = 5.76 GB/day
- **Monthly**: 5.76 GB × 30 = 172.8 GB/month
- **Yearly**: 172.8 GB × 12 = 2.07 TB/year

## 🏗️ Infrastructure Sizing Guide

### AWS EC2 Instance Recommendations

| Log Volume | Instance Type | vCPU | RAM | Storage | Monthly Cost* |
|------------|---------------|------|-----|---------|---------------|
| 1-100 logs/min | t3.micro | 2 | 1 GB | 10 GB | $10-15 |
| 100-500 logs/min | t3.small | 2 | 2 GB | 20 GB | $20-30 |
| 500-1000 logs/min | t3.medium | 2 | 4 GB | 50 GB | $35-50 |
| 1000-2000 logs/min | t3.large | 2 | 8 GB | 100 GB | $70-100 |
| 2000-5000 logs/min | t3.xlarge | 4 | 16 GB | 200 GB | $150-200 |
| 5000+ logs/min | t3.2xlarge+ | 8+ | 32+ GB | 500+ GB | $300+ |

*Approximate costs in US East region

### Docker Container Resources

#### Minimal Container (100 logs/min)
```yaml
resources:
  limits:
    memory: "256Mi"
    cpu: "200m"
  requests:
    memory: "128Mi"
    cpu: "100m"
```

#### Standard Container (500 logs/min)
```yaml
resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
  requests:
    memory: "256Mi"
    cpu: "250m"
```

#### High-Volume Container (2000 logs/min)
```yaml
resources:
  limits:
    memory: "1Gi"
    cpu: "1000m"
  requests:
    memory: "512Mi"
    cpu: "500m"
```

## 📈 Scaling Recommendations

### Horizontal Scaling

For very high volumes, run multiple instances:

```bash
# Instance 1: Endpoint + Application logs
npm run generate -- --config endpoint-app-config.yaml

# Instance 2: Server + Firewall logs  
npm run generate -- --config server-fw-config.yaml

# Instance 3: Cloud logs
npm run generate -- --config cloud-config.yaml
```

### Vertical Scaling Limits

**Single Instance Limits** (tested):
- **Maximum tested**: 10,000 logs/minute
- **CPU limit**: ~80% of available cores
- **Memory limit**: ~1.5GB for high-volume generation
- **I/O limit**: Depends on storage type (SSD recommended)

## 🔧 Performance Optimization

### Configuration for High Performance

```yaml
# High-performance config
generators:
  endpoint:
    frequency: 2000
  application:
    frequency: 1500
  server:
    frequency: 1000
  firewall:
    frequency: 3000
  cloud:
    frequency: 500

output:
  format: "json"        # Fastest format
  destination: "file"   # Fastest destination
  file:
    path: "/tmp/logs.json"  # Use fast storage
    rotation: true
    maxSize: "50MB"     # Smaller files for better I/O
    maxFiles: 20
```

### System Optimizations

#### Linux Optimizations
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize I/O scheduler for SSDs
echo noop > /sys/block/sda/queue/scheduler

# Increase network buffers (for syslog output)
sysctl -w net.core.rmem_max=16777216
sysctl -w net.core.wmem_max=16777216
```

#### Node.js Optimizations
```bash
# Increase heap size for high-volume generation
export NODE_OPTIONS="--max-old-space-size=4096"

# Use production optimizations
export NODE_ENV=production
```

## 📊 Performance Monitoring

### Monitor Resource Usage

```bash
# Monitor CPU and memory usage
htop

# Monitor disk I/O
iotop

# Monitor log generation rate
watch 'tail -1000 logs/current/logs.json | wc -l'

# Monitor disk space
df -h

# Check log file sizes
du -sh logs/
```

### Performance Metrics to Track

1. **CPU Usage**: Should stay below 80%
2. **Memory Usage**: Monitor for memory leaks
3. **Disk Usage**: Track growth rate and available space
4. **I/O Wait**: Should be minimal on SSDs
5. **Log Rate**: Verify actual vs. configured rates

## 🚨 Capacity Planning

### Growth Planning

| Current Rate | 6 Months | 1 Year | 2 Years |
|--------------|----------|--------|---------|
| 100 logs/min | 7.2 GB | 14.4 GB | 28.8 GB |
| 500 logs/min | 36 GB | 72 GB | 144 GB |
| 1000 logs/min | 72 GB | 144 GB | 288 GB |
| 2000 logs/min | 144 GB | 288 GB | 576 GB |
| 5000 logs/min | 360 GB | 720 GB | 1.44 TB |

### Storage Retention Strategy

```yaml
# Configure retention based on storage capacity
storage:
  retention: 30    # Keep 30 days for 1GB/day
  retention: 7     # Keep 7 days for 5GB/day  
  retention: 3     # Keep 3 days for 10GB/day
```

## 🔍 Troubleshooting Performance Issues

### Common Performance Problems

#### High CPU Usage
- **Cause**: Log rate too high for available CPU
- **Solution**: Reduce frequency or add more CPU cores
- **Command**: `top -p $(pgrep node)`

#### High Memory Usage
- **Cause**: Memory leaks or buffer accumulation
- **Solution**: Restart service, check for leaks
- **Command**: `ps aux | grep node`

#### Disk Full
- **Cause**: Insufficient storage or retention too long
- **Solution**: Increase storage or reduce retention
- **Command**: `df -h && du -sh logs/`

#### Slow Performance
- **Cause**: Slow storage or network issues
- **Solution**: Use SSD storage, check network
- **Command**: `iotop -a`

### Performance Testing

```bash
# Test maximum sustainable rate
for rate in 100 500 1000 2000 5000; do
  echo "Testing $rate logs/min"
  # Update config with rate
  timeout 300 npm run generate -- --config test-config.yaml
  # Monitor resources and check for issues
done
```

## 📋 Quick Reference

### Sizing Calculator

```bash
# Calculate storage requirements
echo "Enter logs per minute:"
read logs_per_min
echo "Enter days to retain:"
read retention_days

storage_mb=$((logs_per_min * 60 * 24 * retention_days * 400 / 1024 / 1024))
echo "Storage required: ${storage_mb} MB"
```

### Resource Estimation Script

```bash
#!/bin/bash
# Quick resource estimator

logs_per_min=$1
if [ -z "$logs_per_min" ]; then
  echo "Usage: $0 <logs_per_minute>"
  exit 1
fi

echo "=== Resource Estimation for $logs_per_min logs/min ==="
echo "CPU Usage: $((logs_per_min / 50))% - $((logs_per_min / 25))%"
echo "Memory Usage: $((logs_per_min / 5 + 50)) - $((logs_per_min / 3 + 100)) MB"
echo "Storage per day: $((logs_per_min * 60 * 24 * 400 / 1024 / 1024)) MB"
echo "Storage per month: $((logs_per_min * 60 * 24 * 30 * 400 / 1024 / 1024 / 1024)) GB"
```

## 🎯 Best Practices

1. **Start Small**: Begin with low rates and scale up
2. **Monitor Resources**: Watch CPU, memory, and disk usage
3. **Use SSDs**: For better I/O performance
4. **Plan Storage**: Account for growth and retention needs
5. **Test Performance**: Validate rates before production use
6. **Set Alerts**: Monitor disk space and resource usage
7. **Regular Cleanup**: Implement proper log rotation
8. **Backup Strategy**: Plan for log archival if needed

---

**Need help with sizing?** Use the estimation formulas above or create an issue on GitHub for specific requirements!
