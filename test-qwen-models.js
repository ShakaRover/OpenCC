/**
 * Simple test script to verify Qwen models return
 * Run this with: node dist/test-qwen-models.js
 */

import { QwenProvider } from './src/providers/qwen/qwen-provider.js';

async function testQwenModels() {
  try {
    console.log('🔍 Testing Qwen provider models...');
    
    const qwenProvider = new QwenProvider();
    
    // Test getModels
    console.log('📋 Getting models...');
    const models = await qwenProvider.getModels();
    
    console.log('✅ Models response:');
    console.log(`   Object: ${models.object}`);
    console.log(`   Count: ${models.data.length}`);
    console.log(`   Models: ${models.data.map(m => m.id).join(', ')}`);
    
    // Test getCapabilities
    console.log('🔧 Getting capabilities...');
    const capabilities = qwenProvider.getCapabilities();
    
    console.log('✅ Capabilities response:');
    console.log(`   Supported models: ${capabilities.supportedModels.join(', ')}`);
    console.log(`   Supports streaming: ${capabilities.supportsStreaming}`);
    console.log(`   Supports tools: ${capabilities.supportsTools}`);
    console.log(`   Supports vision: ${capabilities.supportsVision}`);
    
    // Verify expectations
    const expectedModel = 'qwen3-coder-plus';
    const hasCorrectModel = models.data.length === 1 && models.data[0].id === expectedModel;
    const capabilitiesCorrect = capabilities.supportedModels.length === 1 && 
                               capabilities.supportedModels[0] === expectedModel;
    
    if (hasCorrectModel && capabilitiesCorrect) {
      console.log('🎉 SUCCESS: Qwen provider correctly returns only qwen3-coder-plus model');
    } else {
      console.log('❌ FAILURE: Qwen provider does not return expected model');
      console.log(`   Expected: ${expectedModel}`);
      console.log(`   Got models: ${models.data.map(m => m.id).join(', ')}`);
      console.log(`   Got capabilities: ${capabilities.supportedModels.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testQwenModels();
}

export { testQwenModels };