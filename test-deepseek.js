/**
 * Quick test script to verify DeepSeek API key works
 * Run with: node test-deepseek.js
 */

const API_KEY = 'sk-b94e4891596740c18225421f39d61819';
const API_URL = 'https://api.deepseek.com/v1';

async function testDeepSeek() {
  try {
    console.log('Testing DeepSeek API connection...\n');
    
    // Test 1: List models
    console.log('1. Testing models endpoint...');
    const modelsResponse = await fetch(`${API_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      console.log('✅ Models endpoint works!');
      console.log(`   Available models: ${models.data?.map(m => m.id).join(', ') || 'N/A'}\n`);
    } else {
      console.log('❌ Models endpoint failed:', await modelsResponse.text());
      return;
    }
    
    // Test 2: Chat completion
    console.log('2. Testing chat completion...');
    const chatResponse = await fetch(`${API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from DeepSeek!" if you can read this.',
          },
        ],
        max_tokens: 50,
      }),
    });
    
    if (chatResponse.ok) {
      const chat = await chatResponse.json();
      const message = chat.choices[0]?.message?.content || 'No response';
      console.log('✅ Chat completion works!');
      console.log(`   Response: ${message}\n`);
    } else {
      const error = await chatResponse.json().catch(() => ({ error: { message: 'Unknown error' } }));
      console.log('❌ Chat completion failed:', error.error?.message || 'Unknown error');
      return;
    }
    
    console.log('🎉 All DeepSeek API tests passed!');
    console.log('\nYour API key is valid and ready to use.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDeepSeek();

