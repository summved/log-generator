# 🛠️ System Setup Guide

This guide helps you set up your system with all the required tools for optimal log generator functionality.

## 📋 Required Tools

### **Core Requirements** ✅
- **Node.js** >= 18.0.0 (Required)
- **npm** (Comes with Node.js)
- **TypeScript** (Installed via npm)

### **Optional but Recommended Tools**

#### **1. Timeout Command (for Timed Testing)**

**Problem**: The `timeout` command is not available on macOS by default.

**Solutions**:

##### **Option A: Use Our Cross-Platform Script** ✅ (Recommended)
We provide a cross-platform timeout script that works on all systems:

```bash
# Already included in the project
./scripts/timeout.sh 30 npm run generate
./scripts/timeout.sh 10 npm run replay -- --file logs_2025-09-04_12-00-38.jsonl

# Or use the convenient npm scripts
npm run test-generate    # 30-second generation test
npm run test-replay      # 10-second replay test  
npm run quick-demo       # 15-second demo

# Or use custom duration scripts
npm run timed-generate 60    # 60-second generation test
npm run timed-replay 30      # 30-second replay test
npm run timed-demo 120       # 120-second (2 minute) demo
```

##### **Option B: Install GNU Coreutils (macOS)**
```bash
# Install via Homebrew
brew install coreutils

# Then use gtimeout instead of timeout
gtimeout 30 npm run generate
gtimeout 10 npm run replay -- --file logs_2025-09-04_12-00-38.jsonl
```

##### **Option C: Manual Process Control**
```bash
# Start process in background
npm run generate &

# Get process ID
PID=$!

# Wait and then kill
sleep 30 && kill $PID
```

#### **2. Advanced Log Analysis Tools** (Optional)

##### **jq - JSON Processing**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Usage examples
cat logs/current/logs_*.jsonl | jq '.message'
cat logs/current/logs_*.jsonl | jq 'select(.mitre.technique == "T1110")'
```

##### **ripgrep - Fast Text Search**
```bash
# macOS  
brew install ripgrep

# Ubuntu/Debian
sudo apt-get install ripgrep

# Usage examples
rg "failed login" logs/current/
rg -A 3 -B 3 "T1110" logs/current/
```

## 🚀 Quick System Check

Run this command to check your system setup:

```bash
# Check Node.js version
node --version

# Check npm version  
npm --version

# Check if our timeout script works
./scripts/timeout.sh 2 echo "Timeout test successful"

# Test basic functionality
npm run status
```

## 🔧 Platform-Specific Notes

### **macOS** 🍎
- ✅ **Works out of the box** with our timeout script
- 🔧 **Optional**: Install GNU coreutils for native `timeout` command
- 📁 **Log location**: `logs/current/` and `logs/historical/`

### **Linux** 🐧  
- ✅ **Native `timeout` command** available
- ✅ **All features work** without additional setup
- 📁 **Log location**: `logs/current/` and `logs/historical/`

### **Windows** 🪟
- ✅ **Works with WSL** (Windows Subsystem for Linux)
- 🔧 **PowerShell alternative**: Use `Start-Sleep` and job control
- 📁 **Log location**: `logs\current\` and `logs\historical\`

## 🧪 Testing Your Setup

### **1. Basic Functionality Test**
```bash
npm run status
npm run mitre-list
npm run attack-chains:list
```

### **2. Quick Generation Test**  
```bash
# Using our timeout script (works on all platforms)
npm run test-generate

# Or manually (stop with Ctrl+C after 30 seconds)
npm run generate -- --duration 30s
```

### **3. Replay Test**
```bash
# Using our timeout script
npm run test-replay -- --file logs_2025-09-04_12-00-38.jsonl --speed 5.0

# Or manually
npm run replay -- --file logs_2025-09-04_12-00-38.jsonl --speed 5.0
```

### **4. Full Demo Test**
```bash
# Complete 15-second demo
npm run quick-demo
```

## 🔍 Troubleshooting

### **"timeout: command not found"**
✅ **Solution**: Use our cross-platform script:
```bash
./scripts/timeout.sh 30 npm run generate
```

### **"Permission denied" on scripts**
✅ **Solution**: Make script executable:
```bash
chmod +x scripts/timeout.sh
```

### **Node.js version issues**
✅ **Solution**: Update Node.js to >= 18.0.0:
```bash
# Check version
node --version

# Update via nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
```

### **High CPU usage during generation**
✅ **Solution**: Reduce frequency or use duration limits:
```bash
# Generate for limited time
npm run generate -- --duration 5m

# Or use test scripts with automatic timeout
npm run test-generate
```

## 📚 Advanced Setup (Optional)

### **Development Environment**
```bash
# Install development dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### **Docker Setup**
```bash
# Build Docker image
npm run docker:build

# Run in container
npm run docker:run
```

### **SIEM Integration Setup**
See [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) for detailed setup instructions for:
- Wazuh
- Splunk  
- ELK Stack
- IBM QRadar

## ✅ Verification Checklist

- [ ] Node.js >= 18.0.0 installed
- [ ] npm working correctly
- [ ] Project dependencies installed (`npm install`)
- [ ] Timeout script executable (`chmod +x scripts/timeout.sh`)
- [ ] Basic commands working (`npm run status`)
- [ ] Log generation working (`npm run test-generate`)
- [ ] Replay functionality working (`npm run test-replay`)
- [ ] D3FEND demo working (`npm run d3fend-demo`)

## 🆘 Getting Help

If you encounter issues:

1. **Check this guide** for common solutions
2. **Run system check** commands above
3. **Check GitHub Issues** for similar problems
4. **Create new issue** with system details and error messages

---

**💡 Pro Tip**: Use our npm test scripts (`npm run test-*`) for quick platform-independent testing!
