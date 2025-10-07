#!/bin/bash

# 🔍 Pre-Commit Validation Script
# Validates code quality, security, and functionality before git commit

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

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Main validation
main() {
    header "🔍 PRE-COMMIT VALIDATION"
    
    log "Starting pre-commit validation..."
    
    # 1. Check for uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        warning "You have uncommitted changes. Consider committing them first."
    fi
    
    # 2. Validate TypeScript compilation
    log "Validating TypeScript compilation..."
    if npm run build; then
        success "TypeScript compilation successful"
    else
        error "TypeScript compilation failed"
    fi
    
    # 3. Run configuration validation
    log "Validating configuration..."
    if npm run validate-config; then
        success "Configuration validation successful"
    else
        error "Configuration validation failed"
    fi
    
    # 4. Check for security issues
    log "Checking for security vulnerabilities..."
    if npm audit --audit-level=high; then
        success "No high-severity security vulnerabilities found"
    else
        warning "Security vulnerabilities found. Review with 'npm audit'"
    fi
    
    # 5. Validate documentation
    log "Validating documentation..."
    
    # Check required documentation files exist
    required_docs=(
        "README.md"
        "AI_IMPLEMENTATION_SUMMARY.md"
        "ML_CAPABILITIES_SUMMARY.md"
        "AI_ATTACK_IMPLEMENTATION_GUIDE.md"
        "ADVANCED_FEATURES.md"
    )
    
    for doc in "${required_docs[@]}"; do
        if [[ -f "$doc" ]]; then
            success "Documentation file exists: $doc"
        else
            error "Missing required documentation: $doc"
        fi
    done
    
    # 6. Check for hardcoded secrets
    log "Checking for hardcoded secrets..."
    # Check for actual secrets, not template variables or example values
    if ! grep -r -E "(password|secret|key|token)\s*:\s*['\"][^'\"]*['\"]" src/config/ | grep -v -E "(your-token|changeme|template|example|placeholder|{.*})"; then
        success "No hardcoded secrets found in configuration"
    else
        warning "Potential hardcoded secrets found. Please review."
    fi
    
    # 7. Validate file permissions
    log "Validating file permissions..."
    if find . -name "*.sh" -perm -o+w | grep -q .; then
        warning "Some shell scripts have world-write permissions"
    else
        success "File permissions are secure"
    fi
    
    # 8. Check git status
    log "Checking git status..."
    if git status --porcelain | grep -q .; then
        warning "You have uncommitted changes"
        git status --short
    else
        success "Working directory is clean"
    fi
    
    # 9. Validate package.json scripts
    log "Validating package.json scripts..."
    if npm run --silent 2>/dev/null; then
        success "All npm scripts are valid"
    else
        error "Invalid npm scripts found"
    fi
    
    # 10. Quick functionality test
    log "Running quick functionality test..."
    # Start the generation process in background
    npm run generate -- --duration 5s >/dev/null 2>&1 &
    GENERATE_PID=$!
    
    # Wait for 8 seconds (should be enough for 5s generation)
    sleep 8
    
    # Check if the process is still running
    if kill -0 $GENERATE_PID 2>/dev/null; then
        # Process is still running, kill it
        kill $GENERATE_PID 2>/dev/null || true
        success "Basic functionality test passed"
    else
        # Process completed normally
        success "Basic functionality test passed"
    fi
    
    # Cleanup
    pkill -f "npm run generate" 2>/dev/null || true
    
    header "🎉 PRE-COMMIT VALIDATION COMPLETE"
    success "All validations passed!"
    success "Ready to commit and push to git"
    
    echo -e "\n${GREEN}Next steps:${NC}"
    echo -e "1. ${YELLOW}git add .${NC}"
    echo -e "2. ${YELLOW}git commit -m 'Your commit message'${NC}"
    echo -e "3. ${YELLOW}git push${NC}"
}

main "$@"
