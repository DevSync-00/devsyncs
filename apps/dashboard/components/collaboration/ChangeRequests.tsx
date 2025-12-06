'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChangeRequest {
  id: string;
  migration_id: string;
  requested_by: string;
  requestedBy?: {
    id: string;
    email: string;
  };
  type: 'modify' | 'reject' | 'request_info';
  title: string;
  description: string;
  suggested_changes?: string;
  status: 'open' | 'in_review' | 'accepted' | 'rejected' | 'closed';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

interface ChangeRequestsProps {
  migrationId?: string;
}

export default function ChangeRequests({ migrationId }: ChangeRequestsProps) {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadChangeRequests();
  }, [migrationId]);

  const loadChangeRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (migrationId) {
        params.append('migrationId', migrationId);
      }

      const response = await fetch(`/api/collaboration/change-requests?${params}`);
      const data = await response.json();
      setChangeRequests(data.changeRequests || []);
    } catch (error) {
      console.error('Error loading change requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId: string, status: string) => {
    try {
      const response = await fetch(`/api/collaboration/change-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        loadChangeRequests();
      }
    } catch (error) {
      console.error('Error updating change request:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'closed':
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'text-green-500';
      case 'rejected':
        return 'text-red-500';
      case 'closed':
        return 'text-gray-500';
      default:
        return 'text-yellow-500';
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading change requests...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Change Requests</h3>
        <span className="text-sm text-muted-foreground">({changeRequests.length})</span>
      </div>

      {changeRequests.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No change requests yet.
        </p>
      ) : (
        <div className="space-y-4">
          {changeRequests.map((request) => (
            <div key={request.id} className="p-4 border rounded-lg bg-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(request.status)}
                    <h4 className="font-semibold">{request.title}</h4>
                    <span className={`text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Requested by {request.requestedBy?.email || request.requested_by}
                  </p>
                  <p className="text-sm mb-2">{request.description}</p>
                  {request.suggested_changes && (
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <p className="text-xs font-medium mb-1">Suggested Changes:</p>
                      <pre className="text-xs whitespace-pre-wrap">{request.suggested_changes}</pre>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {request.status === 'open' || request.status === 'in_review' ? (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(request.id, 'accepted')}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(request.id, 'rejected')}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(request.id, 'closed')}
                  >
                    Close
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

