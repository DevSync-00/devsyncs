'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * DeepSeek Settings Component
 * 
 * Displays DeepSeek configuration information and allows users to understand
 * how to configure DeepSeek for their projects.
 * 
 * Note: Actual API keys are configured server-side via environment variables.
 */
export default function DeepSeekSettings() {
  const [testApiKey, setTestApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async () => {
    if (!testApiKey.trim()) {
      setTestMessage('Please enter an API key to test');
      setTestStatus('error');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      // Test DeepSeek API connection
      const response = await fetch('https://api.deepseek.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setTestStatus('success');
        setTestMessage('DeepSeek API connection successful!');
      } else {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        setTestStatus('error');
        setTestMessage(error?.error?.message || 'Connection failed');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          DeepSeek AI Configuration
        </CardTitle>
        <CardDescription>
          Configure DeepSeek AI provider for migration explanations, risk assessments, and natural language queries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            DeepSeek API keys are configured server-side via environment variables.
            Contact your administrator to set up DeepSeek for your deployment.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label>Environment Variables</Label>
            <div className="mt-2 space-y-2 font-mono text-sm bg-muted p-4 rounded-lg">
              <div>
                <span className="text-muted-foreground"># Required:</span>
                <div className="ml-4">DEEPSEEK_API_KEY=sk-...</div>
              </div>
              <div>
                <span className="text-muted-foreground"># Optional (defaults shown):</span>
                <div className="ml-4">DEEPSEEK_API_URL=https://api.deepseek.com/v1</div>
                <div className="ml-4">AI_PROVIDER=deepseek</div>
              </div>
            </div>
          </div>

          <div>
            <Label>Test API Key Connection</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Test your DeepSeek API key to verify it's working correctly.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter DeepSeek API key to test"
                value={testApiKey}
                onChange={(e) => setTestApiKey(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                variant="outline"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
            {testStatus === 'success' && (
              <Alert className="mt-2 border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <AlertDescription className="text-green-500">
                  {testMessage}
                </AlertDescription>
              </Alert>
            )}
            {testStatus === 'error' && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {testMessage}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label>DeepSeek Models</Label>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>• <code className="bg-muted px-1 rounded">deepseek-chat</code> - Default chat model</li>
              <li>• <code className="bg-muted px-1 rounded">deepseek-coder</code> - Code-focused model</li>
            </ul>
          </div>

          <div>
            <Label>Features Supported</Label>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>✅ Migration explanations</li>
              <li>✅ Risk assessments</li>
              <li>✅ Natural language queries</li>
              <li>✅ Streaming responses</li>
              <li>✅ JSON mode for structured outputs</li>
            </ul>
          </div>

          <div>
            <Label>Documentation</Label>
            <p className="text-sm text-muted-foreground mt-2">
              For more information, visit:{' '}
              <a
                href="https://platform.deepseek.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                DeepSeek Platform Documentation
              </a>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

