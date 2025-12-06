'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Users, User, Globe, Copy, Check } from 'lucide-react';

interface ShareScanResultProps {
  scanReportId: string;
}

export default function ShareScanResult({ scanReportId }: ShareScanResultProps) {
  const [shareType, setShareType] = useState<'team' | 'user' | 'public'>('team');
  const [shareWith, setShareWith] = useState('');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (!shareWith && shareType !== 'public') {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/collaboration/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanReportId,
          shareType,
          shareWith: shareType === 'public' ? 'public' : shareWith,
          permissions: {
            canView: true,
            canComment: true,
            canApprove: false,
            canRequestChanges: false,
          },
        }),
      });

      const data = await response.json();
      if (data.share?.share_token) {
        setShareToken(data.share.share_token);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = () => {
    if (shareToken && typeof window !== 'undefined' && navigator.clipboard) {
      const link = `${window.location.origin}/shared/${shareToken}`;
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.error('Failed to copy:', err);
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Share Scan Result</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Share Type</label>
          <div className="flex gap-2">
            <Button
              variant={shareType === 'team' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShareType('team')}
            >
              <Users className="w-4 h-4 mr-1" />
              Team
            </Button>
            <Button
              variant={shareType === 'user' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShareType('user')}
            >
              <User className="w-4 h-4 mr-1" />
              User
            </Button>
            <Button
              variant={shareType === 'public' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShareType('public')}
            >
              <Globe className="w-4 h-4 mr-1" />
              Public
            </Button>
          </div>
        </div>

        {shareType !== 'public' && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              {shareType === 'team' ? 'Team ID' : 'User ID'}
            </label>
            <input
              type="text"
              value={shareWith}
              onChange={(e) => setShareWith(e.target.value)}
              placeholder={shareType === 'team' ? 'Enter team ID' : 'Enter user ID'}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        )}

        <Button onClick={handleShare} disabled={loading || (!shareWith && shareType !== 'public')}>
          Share
        </Button>

        {shareToken && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Share Link:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded text-sm break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/shared/${shareToken}` : `/shared/${shareToken}`}
              </code>
              <Button size="sm" variant="outline" onClick={copyShareLink}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

