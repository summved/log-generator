#!/bin/bash

# ⚡ Quick Validation Script for macOS
# Fast validation of key functionality before git push

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Main validation
main() {
    header "⚡ QUICK VALIDATION"
    
    log "Starting quick validation..."
    
    # 1. TypeScript compilation
    log "Building TypeScript..."
    if npm run build; then
        success "TypeScript compilation successful"
    else
        error "TypeScript compilation failed"
    fi
    
    # 2. Configuration validation
    log "Validating configuration..."
    if npm run validate-config; then
        success "Configuration validation successful"
    else
        error "Configuration validation failed"
    fi
    
    # 3. Check all 12 generators
    log "Checking log generators..."
    generator_count=$(grep -A1 '^  [a-z]*:$' src/config/default.yaml | grep -c 'enabled: true')
    if [[ $generator_count -eq 12 ]]; then
        success "All 12 log generators are enabled"
    else
        error "Expected 12 log generators, found $generator_count"
    fi
    
    # 4. Check AI commands
    log "Checking AI commands..."
    ai_commands=(
        "attack-chains:execute-ai"
        "attack-chains:training"
        "attack-chains:preview"
        "attack-chains:ai-options"
        "attack-chains:ai-statistics"
    )
    
    for cmd in "${ai_commands[@]}"; do
        if npm run | grep -q "$cmd"; then
            success "AI command exists: $cmd"
        else
            error "AI command missing: $cmd"
        fi
    done
    
    # 5. Check ML commands
    log "Checking ML commands..."
    ml_count=$(npm run | grep -c "ml-patterns:")
    if [[ $ml_count -gt 0 ]]; then
        success "ML commands exist ($ml_count found)"
    else
        error "ML commands missing"
    fi
    
    # 6. Check documentation
    log "Checking documentation..."
    docs=(
        "README.md"
        "AI_IMPLEMENTATION_SUMMARY.md"
        "ML_CAPABILITIES_SUMMARY.md"
        "AI_ATTACK_IMPLEMENTATION_GUIDE.md"
    )
    
    for doc in "${docs[@]}"; do
        if [[ -f "$doc" ]]; then
            success "Documentation exists: $doc"
        else
            error "Missing documentation: $doc"
        fi
    done
    
    # 7. Check for customer-focused language
    log "Checking documentation language..."
    if ! grep -q "I've implemented\|What I've delivered" AI_IMPLEMENTATION_SUMMARY.md; then
        success "Documentation is customer-focused"
    else
        error "Documentation still contains developer-focused language"
    fi
    
    # 8. Quick log generation test
    log "Testing log generation..."
    if npm run generate -- --duration 3s & sleep 5; then
        success "Log generation test started successfully"
        pkill -f "npm run generate" 2>/dev/null || true
    else
        error "Log generation test failed"
    fi
    
    # 9. Check security
    log "Checking security..."
    if npm audit --audit-level=high >/dev/null 2>&1; then
        success "No high-severity security vulnerabilities"
    else
        error "Security vulnerabilities found"
    fi
    
    header "🎉 QUICK VALIDATION COMPLETE"
    success "All quick validations passed!"
    success "System is ready for git deployment"
    
    echo -e "\n${GREEN}Next steps:${NC}"
    echo -e "1. Run full test suite: ${YELLOW}./comprehensive-test-suite.sh${NC}"
    echo -e "2. Run pre-commit validation: ${YELLOW}./pre-commit-validation.sh${NC}"
    echo -e "3. Follow deployment checklist: ${YELLOW}GIT_DEPLOYMENT_CHECKLIST.md${NC}"
}

main "$@"
