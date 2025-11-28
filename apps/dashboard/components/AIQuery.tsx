'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { fetchJSON } from '@/lib/fetch-utils';
import { formatErrorMessage } from '@/lib/error-utils';
import { useToast } from '@/hooks/use-toast';

interface AIQueryProps {
  scanReportId: string;
}

export default function AIQuery({ scanReportId }: AIQueryProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleQuery = async () => {
    if (!question.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const data = await fetchJSON<{ answer: string }>('/api/ai/query', {
        method: 'POST',
        body: JSON.stringify({
          question,
          scanReportId,
        }),
        timeout: 60000, // 60 seconds for AI queries
        retries: 2,
      });

      setAnswer(data.answer);
      setError(null);
    } catch (err) {
      const formatted = formatErrorMessage(err, {
        operation: 'query',
        resource: 'AI',
      });
      setError(formatted.message);
      toast({
        title: formatted.title,
        description: formatted.actionable || formatted.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="space-y-4 border border-border rounded-lg p-6 bg-card">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Ask AI About This Schema</h3>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Ask a question about your schema mismatches..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleQuery}
          disabled={loading || !question.trim()}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Asking...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Ask
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}

      {answer && (
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Answer:
          </div>
          <p className="text-muted-foreground whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Example questions: "What's the safest way to apply this migration?" or "Will this migration cause downtime?"
      </p>
    </div>
  );
}

