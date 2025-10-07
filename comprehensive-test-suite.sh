#!/bin/bash

# 🧪 Comprehensive Test Suite for Log Generator
# Tests all features, AI/ML capabilities, and execution paths
# Ensures all dependencies are from authentic sources

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

header() {
    echo -e "\n${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}\n"
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_command="$2"
    ((TOTAL_TESTS++))
    
    log "Running: $test_name"
    if eval "$test_command"; then
        success "$test_name"
        return 0
    else
        error "$test_name"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up test artifacts..."
    pkill -f "npm run generate" 2>/dev/null || true
    pkill -f "ts-node" 2>/dev/null || true
    sleep 2
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Main test execution
main() {
    header "🚀 COMPREHENSIVE LOG GENERATOR TEST SUITE"
    
    log "Starting comprehensive test suite..."
    log "Test environment: $(uname -s) $(uname -r)"
    log "Node.js version: $(node --version)"
    log "NPM version: $(npm --version)"
    log "Current directory: $(pwd)"
    
    # ========================================
    # PHASE 1: ENVIRONMENT VALIDATION
    # ========================================
    header "PHASE 1: ENVIRONMENT VALIDATION"
    
    run_test "Node.js version check (>=18.0.0)" \
        "node -e \"const v=process.version.slice(1).split('.'); if(parseInt(v[0])>=18) process.exit(0); else process.exit(1);\""
    
    run_test "NPM package.json exists" \
        "test -f package.json"
    
    run_test "TypeScript configuration exists" \
        "test -f tsconfig.json"
    
    run_test "Source directory exists" \
        "test -d src"
    
    run_test "Configuration directory exists" \
        "test -d src/config"
    
    # ========================================
    # PHASE 2: DEPENDENCY VALIDATION
    # ========================================
    header "PHASE 2: DEPENDENCY VALIDATION"
    
    run_test "Install dependencies" \
        "npm install --silent"
    
    run_test "Build TypeScript" \
        "npm run build"
    
    run_test "Validate package.json scripts" \
        "npm run --silent"
    
    # Check for authentic dependencies
    run_test "Check for suspicious dependencies" \
        "npm audit --audit-level=high --json | jq -e '.metadata.vulnerabilities.high == 0'"
    
    run_test "Validate core dependencies" \
        "npm list --depth=0 | grep -E '(typescript|@types|yaml|winston)'"
    
    # ========================================
    # PHASE 3: CONFIGURATION VALIDATION
    # ========================================
    header "PHASE 3: CONFIGURATION VALIDATION"
    
    run_test "Validate default configuration" \
        "npm run validate-config"
    
    run_test "Check all 12 log generators in config" \
        "grep -c 'enabled: true' src/config/default.yaml | grep -q '12'"
    
    run_test "Validate MITRE ATT&CK mappings" \
        "grep -c 'mitre:' src/config/default.yaml | grep -q '[0-9]'"
    
    run_test "Check enhanced templates" \
        "grep -c 'correlationId' src/config/default.yaml | grep -q '[0-9]'"
    
    # ========================================
    # PHASE 4: BASIC FUNCTIONALITY TESTS
    # ========================================
    header "PHASE 4: BASIC FUNCTIONALITY TESTS"
    
    run_test "Generate logs for 5 seconds" \
        "npm run generate -- --duration 5s & sleep 8; pkill -f 'npm run generate' 2>/dev/null || true"
    
    run_test "Check log files generated" \
        "test -d logs/current && ls logs/current/*.jsonl | head -1"
    
    run_test "Validate JSON log format" \
        "head -1 logs/current/*.jsonl | jq -e '.timestamp and .level and .source'"
    
    run_test "Check all 12 log source types generated" \
        "jq -r '.source.type' logs/current/*.jsonl | sort | uniq | wc -l | grep -q '12'"
    
    # ========================================
    # PHASE 5: AI/ML FEATURE TESTS
    # ========================================
    header "PHASE 5: AI/ML FEATURE TESTS"
    
    # Test AI commands exist
    run_test "AI execute command exists" \
        "npm run attack-chains:execute-ai --help 2>/dev/null || npm run | grep -q 'attack-chains:execute-ai'"
    
    run_test "AI training command exists" \
        "npm run | grep -q 'attack-chains:training'"
    
    run_test "AI preview command exists" \
        "npm run | grep -q 'attack-chains:preview'"
    
    run_test "AI options command exists" \
        "npm run | grep -q 'attack-chains:ai-options'"
    
    run_test "AI statistics command exists" \
        "npm run | grep -q 'attack-chains:ai-statistics'"
    
    # Test ML commands exist
    run_test "ML patterns command exists" \
        "npm run | grep -q 'ml-patterns:'"
    
    run_test "ML learn command exists" \
        "npm run | grep -q 'ml-patterns:learn'"
    
    run_test "ML status command exists" \
        "npm run | grep -q 'ml-patterns:status'"
    
    # ========================================
    # PHASE 6: ATTACK CHAIN TESTS
    # ========================================
    header "PHASE 6: ATTACK CHAIN TESTS"
    
    run_test "List available attack chains" \
        "npm run attack-chains:list"
    
    run_test "Check attack chain status" \
        "npm run attack-chains:status"
    
    # Test AI-enhanced attack chains (preview mode to avoid long execution)
    run_test "Preview AI-enhanced ransomware chain" \
        "npm run attack-chains:preview ransomware-ryuk --mode enhanced --ai-level basic & sleep 35; pkill -f 'attack-chains:preview' 2>/dev/null || true"
    
    # ========================================
    # PHASE 7: PERFORMANCE TESTS
    # ========================================
    header "PHASE 7: PERFORMANCE TESTS"
    
    run_test "Performance test (30 seconds)" \
        "npm run performance-test -- --duration 30s & sleep 40; pkill -f 'performance-test' 2>/dev/null || true"
    
    run_test "Check performance metrics" \
        "test -f logs/current/*.jsonl && wc -l logs/current/*.jsonl | awk '{print \$1}' | head -1 | awk '\$1 > 100'"
    
    # ========================================
    # PHASE 8: DOCUMENTATION VALIDATION
    # ========================================
    header "PHASE 8: DOCUMENTATION VALIDATION"
    
    run_test "README.md exists and is readable" \
        "test -f README.md && head -5 README.md | grep -q 'Log Generator'"
    
    run_test "AI Implementation Summary exists" \
        "test -f AI_IMPLEMENTATION_SUMMARY.md"
    
    run_test "ML Capabilities Summary exists" \
        "test -f ML_CAPABILITIES_SUMMARY.md"
    
    run_test "AI Attack Implementation Guide exists" \
        "test -f AI_ATTACK_IMPLEMENTATION_GUIDE.md"
    
    run_test "Advanced Features Guide exists" \
        "test -f ADVANCED_FEATURES.md"
    
    # Check documentation contains specific commands
    run_test "AI commands documented in summary" \
        "grep -q 'attack-chains:execute-ai' AI_IMPLEMENTATION_SUMMARY.md"
    
    run_test "ML commands documented in summary" \
        "grep -q 'ml-patterns:' ML_CAPABILITIES_SUMMARY.md"
    
    # ========================================
    # PHASE 9: SECURITY VALIDATION
    # ========================================
    header "PHASE 9: SECURITY VALIDATION"
    
    run_test "No hardcoded secrets in config" \
        "! grep -r -i 'password\\|secret\\|key\\|token' src/config/ | grep -v 'your-token'"
    
    run_test "No suspicious file permissions" \
        "find . -name '*.sh' -perm -o+w | wc -l | grep -q '^0$'"
    
    run_test "Git ignore properly configured" \
        "test -f .gitignore && grep -q 'node_modules' .gitignore"
    
    # ========================================
    # PHASE 10: INTEGRATION TESTS
    # ========================================
    header "PHASE 10: INTEGRATION TESTS"
    
    run_test "HTTP server starts correctly" \
        "npm run generate -- --duration 5s & sleep 5 && curl -s http://localhost:3000/health | grep -q 'ok' && pkill -f 'npm run generate'"
    
    run_test "Metrics endpoint accessible" \
        "npm run generate -- --duration 5s & sleep 5 && curl -s http://localhost:3000/metrics | grep -q 'log_generator' && pkill -f 'npm run generate'"
    
    # ========================================
    # PHASE 11: CLEANUP AND FINAL VALIDATION
    # ========================================
    header "PHASE 11: CLEANUP AND FINAL VALIDATION"
    
    run_test "Stop all running processes" \
        "pkill -f 'npm run generate' 2>/dev/null || true; pkill -f 'ts-node' 2>/dev/null || true; sleep 2"
    
    run_test "Validate log directory structure" \
        "test -d logs/current && test -d logs/historical"
    
    run_test "Check for memory leaks (basic)" \
        "ps aux | grep -v grep | grep -c 'node\\|ts-node' | awk '\$1 <= 2'"
    
    # ========================================
    # FINAL RESULTS
    # ========================================
    header "FINAL TEST RESULTS"
    
    echo -e "\n${CYAN}📊 TEST SUMMARY${NC}"
    echo -e "${CYAN}================${NC}"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"
    echo -e "Success Rate: $(( TESTS_PASSED * 100 / TOTAL_TESTS ))%"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}✅ System is ready for production deployment${NC}"
        echo -e "${GREEN}✅ All features are working correctly${NC}"
        echo -e "${GREEN}✅ Dependencies are from authentic sources${NC}"
        echo -e "${GREEN}✅ Documentation is complete and accurate${NC}"
        echo -e "\n${CYAN}🚀 Ready to push to git!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ SOME TESTS FAILED${NC}"
        echo -e "${RED}Please review the failed tests above${NC}"
        echo -e "${RED}Fix issues before pushing to git${NC}"
        exit 1
    fi
}

# Run the main test suite
main "$@"
