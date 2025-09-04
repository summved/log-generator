#!/bin/bash

echo "🧪 Testing Log Generator Installation"
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build the project"
    exit 1
fi

echo "✅ Project built successfully"

# Test CLI help
echo "🚀 Testing CLI..."
npx ts-node src/cli.ts --help

if [ $? -ne 0 ]; then
    echo "❌ CLI test failed"
    exit 1
fi

echo "✅ CLI is working"

# Test configuration initialization
echo "📋 Testing configuration initialization..."
npx ts-node src/cli.ts init --output ./test-config.yaml

if [ $? -ne 0 ]; then
    echo "❌ Configuration initialization failed"
    exit 1
fi

echo "✅ Configuration initialized"

# Validate configuration
echo "🔍 Validating configuration..."
npx ts-node src/cli.ts config --config ./test-config.yaml --validate

if [ $? -ne 0 ]; then
    echo "❌ Configuration validation failed"
    exit 1
fi

echo "✅ Configuration is valid"

# Clean up test files
rm -f ./test-config.yaml

echo ""
echo "🎉 All tests passed! The log generator is ready to use."
echo ""
echo "Quick start:"
echo "  1. Initialize config: npx ts-node src/cli.ts init"
echo "  2. Start generating: npm run generate"
echo "  3. Check status: npx ts-node src/cli.ts status"
echo ""
echo "For more information, see README.md"
