'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  author_id: string;
  author?: {
    id: string;
    email: string;
  };
  created_at: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
}

interface CommentsSectionProps {
  scanReportId: string;
  mismatchId?: string;
}

export default function CommentsSection({ scanReportId, mismatchId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [scanReportId, mismatchId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scanReportId });
      if (mismatchId) {
        params.append('mismatchId', mismatchId);
      }

      const response = await fetch(`/api/collaboration/comments?${params}`);
      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/collaboration/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanReportId,
          mismatchId,
          content: newComment,
        }),
      });

      if (response.ok) {
        setNewComment('');
        loadComments();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string, resolved: boolean) => {
    try {
      const response = await fetch(`/api/collaboration/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });

      if (response.ok) {
        loadComments();
      }
    } catch (error) {
      console.error('Error resolving comment:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Comments</h3>
        <span className="text-sm text-muted-foreground">({comments.length})</span>
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full p-3 border rounded-lg resize-none"
          rows={3}
        />
        <Button type="submit" disabled={submitting || !newComment.trim()}>
          <Send className="w-4 h-4 mr-2" />
          Post Comment
        </Button>
      </form>

      {/* Comments List */}
      {loading ? (
        <p className="text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 border rounded-lg ${
                comment.resolved ? 'bg-muted/50' : 'bg-card'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">
                      {comment.author?.email || 'Unknown'}
                    </span>
                    {comment.resolved && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{comment.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!comment.resolved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolve(comment.id, true)}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                )}
                {comment.resolved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolve(comment.id, false)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

