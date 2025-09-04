#!/usr/bin/env node

const { LogGeneratorManager } = require('../dist/index');

async function basicExample() {
  console.log('🚀 Starting Log Generator Example');
  
  // Create a log generator instance
  const logGenerator = new LogGeneratorManager();
  
  // Show initial status
  console.log('📊 Generator Status:', logGenerator.getGeneratorStatus());
  console.log('📁 Historical Files:', await logGenerator.getHistoricalFiles());
  
  // Start generating logs
  console.log('▶️  Starting log generation...');
  await logGenerator.start();
  
  // Let it run for 30 seconds
  console.log('⏱️  Generating logs for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Show status after running
  console.log('📊 Generator Status:', logGenerator.getGeneratorStatus());
  
  // Stop the generators
  console.log('⏹️  Stopping log generation...');
  await logGenerator.stop();
  
  console.log('✅ Example completed! Check the logs directory for generated logs.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, exiting...');
  process.exit(0);
});

// Run the example
basicExample().catch(error => {
  console.error('❌ Error running example:', error);
  process.exit(1);
});
