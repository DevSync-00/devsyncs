'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ApprovalStep {
  id: string;
  approver_id: string;
  approver?: {
    id: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  actioned_at?: string;
  order: number;
}

interface ApprovalWorkflow {
  id: string;
  migration_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  required_approvals: number;
  current_approvals: number;
  steps: ApprovalStep[];
  created_at: string;
  updated_at: string;
}

interface ApprovalWorkflowProps {
  migrationId: string;
}

export default function ApprovalWorkflowComponent({ migrationId }: ApprovalWorkflowProps) {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, [migrationId]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/collaboration/approvals?migrationId=${migrationId}`);
      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (workflowId: string, stepId: string, approved: boolean, comment?: string) => {
    try {
      const response = await fetch(`/api/collaboration/approvals/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          comment,
          stepId,
        }),
      });

      if (response.ok) {
        loadWorkflows();
      }
    } catch (error) {
      console.error('Error approving/rejecting:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-500';
      case 'rejected':
        return 'text-red-500';
      default:
        return 'text-yellow-500';
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading approval workflows...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Approval Workflows</h3>
        {workflows.length === 0 && (
          <Button onClick={() => setShowCreate(!showCreate)}>
            Create Approval Workflow
          </Button>
        )}
      </div>

      {workflows.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No approval workflows yet.
        </p>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="p-4 border rounded-lg bg-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(workflow.status)}
                  <span className={`font-medium ${getStatusColor(workflow.status)}`}>
                    {workflow.status.toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {workflow.current_approvals} / {workflow.required_approvals} approvals
                </span>
              </div>

              <div className="space-y-2">
                {workflow.steps?.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(step.status)}
                      <div>
                        <p className="text-sm font-medium">
                          {step.approver?.email || step.approver_id}
                        </p>
                        {step.comment && (
                          <p className="text-xs text-muted-foreground">{step.comment}</p>
                        )}
                        {step.actioned_at && (
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(step.actioned_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                    {step.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(workflow.id, step.id, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(workflow.id, step.id, false)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

