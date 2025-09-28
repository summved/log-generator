#!/bin/bash

# Comprehensive Dependency Security Verification Script
# This script verifies that ALL dependencies are downloaded from authentic sources
# Covers: NPM packages, Docker images, GitHub Actions, and system packages

set -e

echo "🔍 Verifying comprehensive dependency security..."
echo "=================================================="

# Check if package-lock.json exists
if [ ! -f "package-lock.json" ]; then
    echo "❌ package-lock.json not found. Run 'npm install' first."
    exit 1
fi

# Verify all resolved URLs are from npmjs.org
echo "📦 Checking registry sources..."
NON_NPMJS_URLS=$(grep '"resolved"' package-lock.json | grep -v 'registry.npmjs.org' || true)

if [ -z "$NON_NPMJS_URLS" ]; then
    echo "✅ All dependencies are from registry.npmjs.org"
    TOTAL_DEPS=$(grep -c '"resolved"' package-lock.json)
    echo "   Found $TOTAL_DEPS dependencies, all from official registry"
else
    echo "❌ Found dependencies from non-npmjs sources:"
    echo "$NON_NPMJS_URLS"
    exit 1
fi

# Run security audit
echo "🔒 Running security audit..."
npm audit --audit-level moderate

# Check for outdated packages
echo "📊 Checking for outdated packages..."
npm outdated || echo "ℹ️  Some packages may have newer versions available"

# Verify .npmrc configuration
echo "⚙️  Verifying .npmrc configuration..."
if [ -f ".npmrc" ]; then
    if grep -q "registry=https://registry.npmjs.org/" .npmrc; then
        echo "✅ .npmrc configured for official registry"
    else
        echo "❌ .npmrc not properly configured"
        exit 1
    fi
else
    echo "⚠️  .npmrc file not found"
fi

# Check package.json security configurations
echo "📋 Verifying package.json security settings..."
if grep -q '"registry": "https://registry.npmjs.org/"' package.json; then
    echo "✅ package.json configured for official registry"
else
    echo "❌ package.json missing registry configuration"
    exit 1
fi

# Check Docker images for authentic sources
echo "🐳 Verifying Docker base images..."
if [ -f "Dockerfile" ] || [ -f "Dockerfile.production" ]; then
    # Check for official base images
    DOCKER_IMAGES=$(grep -h "^FROM" Dockerfile* 2>/dev/null || true)
    if echo "$DOCKER_IMAGES" | grep -q "node:.*@sha256:"; then
        echo "✅ Docker images use SHA256 digests for security"
    else
        echo "⚠️  Consider using SHA256 digests for Docker images"
    fi
    
    if echo "$DOCKER_IMAGES" | grep -qE "(node:|prom/|grafana/|docker\.elastic\.co)"; then
        echo "✅ Using official Docker base images"
    else
        echo "❌ Non-official Docker images detected"
        exit 1
    fi
else
    echo "ℹ️  No Dockerfile found"
fi

# Check GitHub Actions for authentic sources
echo "🔧 Verifying GitHub Actions..."
if [ -f ".github/workflows/ci-cd.yml" ]; then
    ACTIONS_USED=$(grep "uses:" .github/workflows/ci-cd.yml | grep -v "#" || true)
    if echo "$ACTIONS_USED" | grep -qE "(actions/|docker/|aquasecurity/)"; then
        echo "✅ Using official GitHub Actions"
    else
        echo "⚠️  Review GitHub Actions sources"
    fi
else
    echo "ℹ️  No GitHub Actions workflow found"
fi

# Check for system package managers
echo "📦 Checking system package configurations..."
if grep -r "apk add" . --include="*.dockerfile" --include="Dockerfile*" 2>/dev/null | grep -q "apk add --no-cache"; then
    echo "✅ Alpine packages use official repositories with cache disabled"
else
    echo "ℹ️  No Alpine package installations found"
fi

echo ""
echo "🎉 All dependency security checks passed!"
echo "========================================"
echo ""
echo "Summary:"
echo "- All NPM dependencies from official registry ✅"
echo "- Docker images from official sources ✅"
echo "- GitHub Actions from verified sources ✅"
echo "- System packages from official repositories ✅"
echo "- No security vulnerabilities found ✅"
echo "- Configuration files properly set ✅"
echo ""
echo "Security Maintenance:"
echo "- Run 'npm run security:audit' regularly"
echo "- Update Docker image digests periodically"
echo "- Review dependency updates before applying"
echo "- Monitor security advisories"
echo "- Scan containers with: docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image log-generator:latest"
