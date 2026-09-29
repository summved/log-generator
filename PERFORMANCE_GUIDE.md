# 🚀 Performance Guide

This comprehensive guide covers performance analysis, benchmarking, and optimization for the Log Generator, including the latest **Worker Threads**, **Network Output**, and **Memory-First Architecture**.

## 📊 Performance Overview

### Measure it on your machine: `npm run benchmark`

```bash
npm run benchmark                                  # everything, 3s per measurement (~1.5 minutes)
npm run benchmark -- --duration 1s                 # quicker
npm run benchmark -- --phases workers --workers 1,2,4,8 --format cef
npm run benchmark -- --json benchmark.json         # also save the full report
```

The benchmark uses the real generators, formatters and `OutputManager`, running flat out with no timers:

| Phase | What it measures |
|---|---|
| `generators` | Each of the 12 generators on one thread, then all of them together |
| `formats` | `json`, `syslog`, `cef` and `wazuh` formatting on the same sample |
| `outputs` | The full output path (generate, format, send, per-log history copy) to a temporary file, and to HTTP and UDP syslog receivers on 127.0.0.1. It counts how many logs arrived. Nothing leaves the machine. |
| `workers` | All generators plus formatting on 1, 2, 4… worker threads, up to the CPU count |

### Measured results

Apple M4 Pro, 14 CPUs, Node 26, 3s per measurement:

| Measurement | Logs/second |
|---|---|
| One generator, one thread | 85,000–159,000 (depends on the log type) |
| All 12 generators, one thread | ~99,000 |
| Formatting: json / cef / wazuh / syslog | 1,133,000 / 1,719,000 / 782,000 / 300,000 |
| Output to file (incl. history copy) | ~37,000 (100% delivered) |
| Output to HTTP, local receiver | ~36,000 (100% delivered) |
| Output to UDP syslog, local receiver | ~16,000 |
| History copy on its own | ~38,000 |
| Worker threads (generate + JSON): 1 / 4 / 8 / 14 workers | 85,000 / 304,000 / 579,000 / 655,000 |

What this shows:
- **The generators aren't the limit.** One thread makes about 100k logs/s, and worker threads scale almost linearly, to about 655k logs/s on 14 CPUs.
- **The output path is the limit.** File and HTTP output top out at the speed of the per-log history copy (`StorageManager.storeLog`, one `appendFile` per log). UDP syslog is slower because every message opens a new socket.
- **Timestamps stay on the clock.** Logs in the same millisecond use sub-millisecond slots (six fractional digits). Each worker thread gets its own slots, so timestamps never collide across threads. The benchmark warns if timestamps ever run ahead (only above 1M logs/s in one thread).

### Generating at full force: `generate --workers`

```bash
npm run generate -- --workers 4                    # 4 worker threads share the configured rates
npm run performance-test -- --mode worker --workers 4 --duration 30s   # reports logs generated and logs/s
```

With `--workers N`, each worker thread runs every enabled generator at 1/N of its configured rate, so the total rate is what the config says. The main thread applies MITRE filters and metrics, then writes the output and the history copy.

Rates are set per generator in the config (`frequency`, logs per minute). To go flat out, set frequencies higher than the tool can produce. Generation then runs as fast as the output can write, and **flow control** keeps memory bounded:
- Without workers, the generators pause while more than 50,000 logs are still being written.
- With workers, each worker pauses while more than 20,000 of its logs are waiting for the main thread.

Every generator at 100k logs/s (far more than can be written), 10 s, file output, `node dist/cli.js`, M4 Pro. Every log was written to both the output file and the history copy:

| Worker threads | Logs/second | Peak memory |
|---|---|---|
| none (main thread) | ~70,000 | ~720 MB |
| 2 | ~165,000 | ~1.1 GB |
| 4 | **~304,000** | ~2.7 GB |
| 8 | ~239,000 | ~3.1 GB |

- More workers stop helping once the main thread, which does all the writing, is saturated. Try `npm run benchmark` and a few `--workers` values on your hardware.
- Memory stays flat over time. The same test over 30 s peaked at the same level.


`performance-test` runs the configured generators at their configured rates for a set time. It shows which generators ran; for maximum throughput, use `benchmark`.

## ⚡ High-Performance Worker Threads

### Architecture Overview

The log generator now supports parallel processing using Node.js worker threads for maximum performance:

#### **Key Components**
- **WorkerPoolManager** - Manages pool of worker threads
- **HighPerformanceGenerator** - Coordinates parallel log generation
- **Memory-First Buffering** - 10,000 log buffer before I/O operations
- **Load Balancing** - Automatic work distribution across threads

#### **Performance Benefits**
```
Single Thread:     1,000 logs/sec
4 Worker Threads:  5,000-10,000 logs/sec (5-10x improvement)
8 Worker Threads:  10,000-20,000 logs/sec (10-20x improvement)
```

### Worker Thread Configuration

#### **Optimal Worker Count**
```bash
# Match CPU cores for best performance
npm run performance-test -- --mode worker --workers 4 --duration 30s

# Test different configurations
npm run performance-test -- --mode worker --workers 8 --duration 30s
```

#### **Memory-First Configuration**
```yaml
generators:
  endpoint:
    enabled: true
    frequency: 300000  # 5,000 logs/second target
    
output:
  format: json
  destination: http  # Network output for best performance
  batching:
    maxBatchSize: 1000    # Large batches for efficiency
    flushIntervalMs: 100  # Fast flushing
    enabled: true
```

## 🌐 Network Output Performance

### Performance Comparison: Disk vs Network

Our comprehensive testing reveals significant performance differences:

#### **Actual Performance Results**
```
📊 PERFORMANCE COMPARISON RESULTS
============================================================
🥇 HTTP (Network): 5,000-20,000 logs/sec
🥈 Syslog (UDP):   10,000+ logs/sec  
🥉 Disk I/O:       100-1,000 logs/sec
```

#### **Why Network is Faster**
1. **Async I/O** - Network operations don't block Node.js event loop
2. **Batching Efficiency** - 100-1000 logs per HTTP request
3. **No Disk Seeks** - Network packets avoid filesystem overhead
4. **SIEM Optimization** - Purpose-built for high-throughput ingestion

### Network Configuration Examples

#### **HTTP SIEM Integration**
```yaml
output:
  format: json
  destination: http
  batching:
    maxBatchSize: 500
    flushIntervalMs: 200
    enabled: true
  http:
    url: "https://your-splunk.com:8088/services/collector/event"
    headers:
      "Authorization": "Splunk your-hec-token"
      "Content-Type": "application/json"
```

#### **Syslog Integration**
```yaml
output:
  format: syslog
  destination: syslog
  batching:
    maxBatchSize: 100
    flushIntervalMs: 500
    enabled: true
  syslog:
    host: "your-siem.company.com"
    port: 514
    protocol: "udp"
```

## 📈 Performance Testing Framework

### Comprehensive Testing Commands

```bash
# Test all output methods
npm run performance-test -- --mode disk --duration 10s
npm run performance-test -- --mode http --duration 10s
npm run performance-test -- --mode syslog --duration 10s
npm run performance-test -- --mode worker --workers 4 --duration 10s

# Run comprehensive comparison
node src/scripts/performance-comparison.js
```

### Performance Test Results

#### **Real-World Test Results (10-second tests)**
```
🏆 RANKING (by logs/second):
   🥇 WORKER THREADS: 15,000+ logs/sec
      Configuration: 4 workers, memory-first buffering
      
   🥈 HTTP NETWORK: 8,000-12,000 logs/sec
      Configuration: Batch size 500, 200ms flush
      
   🥉 SYSLOG UDP: 6,000-10,000 logs/sec
      Configuration: Batch size 100, 500ms flush
      
   🏅 DISK I/O: 500-1,500 logs/sec
      Configuration: Standard file output
```

## 🔄 Advanced Replay Performance

### Batch Processing Architecture

The replay functionality uses batch processing for maximum performance:

#### **Performance Comparison**
| **Architecture** | **Batch Size** | **50K Logs Time** | **Logs/Second** | **Improvement** |
|---|---|---|---|---|
| **Original (Single)** | 1 | 133.0s | 376 logs/s | Baseline |
| **Batch Processing** | 100 | 7.0s | **7,143 logs/s** | **🚀 19x faster** |
| **High-Performance Batch** | 1000 | 7.0s | **7,143 logs/s** | **🚀 19x faster** |

#### **Batch Processing Usage**
```bash
# Standard replay
npm run replay -- --file logs_2025-09-04_12-00-47.jsonl --speed 2.0

# High-performance batch replay
npm run replay -- --file logs_2025-09-04_12-00-47.jsonl --batch-size 100 --speed 10

# Maximum performance replay
npm run replay -- --file logs_2025-09-04_12-00-47.jsonl --batch-size 1000 --speed 20
```

## 🎯 Performance Optimization Guidelines

### Hardware Recommendations

#### **For High-Performance Generation (10,000+ logs/sec)**
- **CPU** - 8+ cores, 3.0GHz+ (Intel i7/AMD Ryzen 7 or better)
- **Memory** - 16GB+ RAM
- **Storage** - NVMe SSD (for disk output scenarios)
- **Network** - Gigabit connection (for SIEM integration)

#### **For Standard Generation (1,000-5,000 logs/sec)**
- **CPU** - 4+ cores, 2.5GHz+
- **Memory** - 8GB+ RAM
- **Storage** - SSD recommended
- **Network** - 100Mbps+ connection

#### **For Development/Testing (100-1,000 logs/sec)**
- **CPU** - 2+ cores, 2.0GHz+
- **Memory** - 4GB+ RAM
- **Storage** - Any modern storage
- **Network** - Standard connection

### Configuration Optimization

#### **Batch Size Optimization**
```yaml
# For Network Output (HTTP/Syslog)
batching:
  maxBatchSize: 500-1000    # Large batches for network efficiency
  flushIntervalMs: 100-200  # Fast flushing for low latency
  
# For Disk Output
batching:
  maxBatchSize: 100-500     # Moderate batches to prevent memory issues
  flushIntervalMs: 500-1000 # Longer intervals for disk efficiency
```

#### **Generator Frequency Optimization**
```yaml
# Conservative (Safe for all hardware)
generators:
  endpoint:
    frequency: 60000  # 1,000 logs/sec
    
# High Performance (Requires good hardware)
generators:
  endpoint:
    frequency: 300000  # 5,000 logs/sec
    
# Extreme Performance (Requires enterprise hardware)
generators:
  endpoint:
    frequency: 720000  # 12,000 logs/sec
```

## 📊 Performance Monitoring

### Built-in Performance Statistics

```bash
# Check current performance stats
npm run status

# Get detailed performance information
npm run performance-test -- --mode worker --workers 4 --duration 60s
```

### Configuration Validation

```bash
# Validate configuration for performance issues
npm run validate-config --config src/config/extreme-performance.yaml

# Get performance recommendations
npm run validate-config --config src/config/high-performance.yaml
```

### Example Validation Output

```
🔍 Validating Configuration...

⚠️ Warnings:
   ⚠️ EXTREME: Generator 'endpoint' frequency 720,000 (12,000 logs/sec)
   ⚠️ HIGH: Total system frequency 1,200,000 logs/min (20,000 logs/sec)
   ⚠️ Estimated disk I/O: 10000.0 MB/s - ensure adequate disk performance

💡 Recommendations:
   💡 EXTREME PERFORMANCE SETUP: Use enterprise-grade hardware
   💡 MONITORING: Set up system monitoring for CPU, memory, disk I/O
   💡 Consider using HTTP output for better performance than disk I/O
```

## 🚀 Performance Tuning Strategies

### 1. Output Method Selection

**Choose the right output method for your use case:**

```bash
# For maximum performance - Use HTTP output to SIEM
npm run performance-test -- --mode http --duration 30s

# For traditional systems - Use Syslog UDP
npm run performance-test -- --mode syslog --duration 30s

# For development - Use disk output
npm run performance-test -- --mode disk --duration 30s
```

### 2. Worker Thread Optimization

**Scale worker threads based on CPU cores:**

```bash
# Check CPU cores
nproc  # Linux
sysctl -n hw.ncpu  # macOS

# Use appropriate worker count
npm run performance-test -- --mode worker --workers $(nproc) --duration 30s
```

### 3. Memory Management

**Optimize memory usage for sustained performance:**

```yaml
# Memory-optimized configuration
output:
  batching:
    maxBatchSize: 1000      # Large batches reduce overhead
    flushIntervalMs: 100    # Fast flushing prevents memory buildup
    enabled: true
```

### 4. Network Optimization

**For SIEM integration:**

```yaml
# Network-optimized configuration
output:
  format: json
  destination: http
  http:
    url: "https://your-siem.com/api/logs"
    headers:
      "Content-Type": "application/json"
      "Connection": "keep-alive"  # Reuse connections
```

## 🔧 Troubleshooting Performance Issues

### Common Performance Problems

#### **Low Generation Rate**
**Symptoms:** Less than expected logs/second
**Solutions:**
1. Check CPU usage - ensure not at 100%
2. Verify disk I/O - consider SSD upgrade
3. Test network output - may be faster than disk
4. Enable worker threads for parallel processing

#### **High Memory Usage**
**Symptoms:** Increasing memory consumption
**Solutions:**
1. Reduce batch sizes
2. Increase flush intervals
3. Monitor buffer sizes
4. Consider streaming output

#### **Network Timeouts**
**Symptoms:** HTTP/Syslog connection failures
**Solutions:**
1. Increase timeout values
2. Reduce batch sizes
3. Check network connectivity
4. Verify SIEM endpoint capacity

### Performance Debugging Commands

```bash
# Monitor system resources during generation
npm run performance-test -- --mode worker --duration 60s &
top -p $!  # Monitor CPU/memory usage

# Test different configurations
npm run performance-test -- --config src/config/safe-high-performance.yaml
npm run performance-test -- --config src/config/extreme-performance.yaml

# Validate configuration before testing
npm run validate-config --config your-config.yaml
```

## 📈 Performance Benchmarks

### Benchmark Results Summary

#### **Generation Performance**
- **Standard Configuration**: 100-1,000 logs/sec
- **High-Performance Configuration**: 5,000-10,000 logs/sec
- **Extreme Configuration**: 15,000-20,000+ logs/sec
- **Worker Threads (4 cores)**: 20,000+ logs/sec
- **Worker Threads (8 cores)**: 40,000+ logs/sec

#### **Output Performance**
- **Disk I/O**: 500-1,500 logs/sec
- **HTTP Network**: 8,000-15,000 logs/sec
- **Syslog UDP**: 10,000+ logs/sec
- **Memory Buffer**: 50,000+ logs/sec (before I/O)

#### **Replay Performance**
- **Single Log Processing**: 376 logs/sec
- **Batch Processing (100)**: 7,143 logs/sec (19x faster)
- **Batch Processing (1000)**: 7,143 logs/sec (19x faster)

### Performance Scaling

#### **CPU Core Scaling**
```
2 Cores:  5,000-8,000 logs/sec
4 Cores:  10,000-15,000 logs/sec
8 Cores:  20,000-30,000 logs/sec
16 Cores: 40,000+ logs/sec
```

#### **Memory Scaling**
```
4GB RAM:  Up to 5,000 logs/sec
8GB RAM:  Up to 15,000 logs/sec
16GB RAM: Up to 30,000 logs/sec
32GB RAM: 50,000+ logs/sec
```

## 📊 Real-time Performance Monitoring

### Built-in Metrics Collection

The log generator includes comprehensive performance monitoring with zero overhead:

#### **Live Performance Metrics**
```bash
# Check current performance
curl http://localhost:3000/health

# Get Prometheus metrics
curl http://localhost:3000/metrics

# Detailed status
curl http://localhost:3000/status
```

#### **Key Performance Indicators**
- **Total Logs Generated** - Cumulative count since startup
- **Current Logs/Second** - Real-time generation rate
- **Generator Status** - Individual generator performance
- **Error Count** - System reliability metrics
- **Uptime** - System stability tracking

### Docker Container Performance

#### **Verified Performance Results**
Based on actual testing with the Docker monitoring stack:

| **Configuration** | **Native Performance** | **Docker Performance** | **Monitoring Overhead** |
|---|---|---|---|
| **Standard Config** | 6,000-7,150 logs/sec | 6,000+ logs/sec | < 1% |
| **With Prometheus** | 6,000-7,150 logs/sec | 6,000+ logs/sec | < 2% |
| **Full Stack** | 6,000-7,150 logs/sec | 6,000+ logs/sec | < 3% |

#### **Monitoring Stack Components**
- **Log Generator** - Main application with metrics endpoint
- **Prometheus** - Metrics collection (5s scrape interval)
- **Grafana** - Real-time dashboards and visualization
- **HTTPBin** - SIEM endpoint testing

### Performance Monitoring Queries

#### **Prometheus Queries for Performance Analysis**
```promql
# Current generation rate
log_generator_logs_per_second

# Total logs generated
log_generator_logs_total

# Rate of generation over 5 minutes
rate(log_generator_logs_total[5m])

# Average logs per second over 1 minute
avg_over_time(log_generator_logs_per_second[1m])

# Peak performance in last hour
max_over_time(log_generator_logs_per_second[1h])

# Logs by generator type
sum by (generator) (log_generator_by_source_total)
```

#### **Grafana Dashboard Metrics**
- **Real-time Generation Rate** - Time series chart with 5s refresh
- **Total Logs Counter** - Cumulative statistics
- **Generator Distribution** - Pie chart of logs by source
- **System Health** - Error rates and uptime tracking

### Performance Testing Results

#### **Actual Test Results (10-second tests)**
```
Native Generation:     6,000-7,150 logs/second
Docker Container:      6,000+ logs/second  
HTTP SIEM (tested):    100 logs/second (configurable)
Syslog SIEM (tested):  60 logs/second (configurable)
```

#### **Resource Utilization**
```
CPU Usage:     15-25% (single core)
Memory Usage:  150-300 MB
Disk I/O:      2-3 MB/second
Network:       Minimal (metrics only)
```

### Performance Optimization with Monitoring

#### **Using Metrics for Optimization**
1. **Identify Bottlenecks** - Monitor CPU, memory, and I/O metrics
2. **Tune Batch Sizes** - Adjust based on throughput metrics
3. **Scale Horizontally** - Use Kubernetes HPA based on metrics
4. **Optimize Configurations** - Real-time feedback on changes

#### **Alert Configuration**
Set up Grafana alerts for:
- Generation rate drops below 1,000 logs/second
- Error rate exceeds 1%
- Memory usage above 80%
- CPU usage sustained above 90%

## 🎯 Best Practices Summary

### For Maximum Performance
1. **Use Network Output** - HTTP/Syslog to SIEM systems
2. **Enable Worker Threads** - Match CPU core count
3. **Optimize Batch Sizes** - 500-1000 for network, 100-500 for disk
4. **Use Fast Storage** - NVMe SSD for disk-based scenarios
5. **Monitor Resources** - CPU, memory, network utilization

### For Reliability
1. **Start Conservative** - Begin with lower rates, scale up
2. **Validate Configuration** - Always run validation before production
3. **Monitor System Health** - Set up alerts for resource usage
4. **Test SIEM Integration** - Verify connectivity and data format
5. **Plan for Growth** - Consider future scaling requirements

### For Development
1. **Use Timed Tests** - Prevent runaway processes
2. **Start with Disk Output** - Easier debugging and analysis
3. **Use Small Durations** - Quick iteration cycles
4. **Monitor Log Quality** - Verify data integrity
5. **Test Different Configurations** - Find optimal settings

---

This performance guide provides comprehensive information for optimizing the log generator for your specific use case. For additional help, see the other documentation files or open an issue on GitHub.