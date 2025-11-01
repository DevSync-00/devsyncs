'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, AlertTriangle, Shield, Clock, Database } from 'lucide-react';

interface AIExplanationProps {
  scanReportId: string;
  migrationId?: string;
}

interface MigrationExplanation {
  summary: string;
  description: string;
  steps: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dataLossRisk: boolean;
  estimatedDowntime: number;
  affectedRecords?: number;
  recommendations: string[];
  rollbackPlan: string;
}

interface RiskAssessment {
  severity: 'low' | 'medium' | 'high' | 'critical';
  dataLossRisk: boolean;
  downtime: number;
  affectedRecords: number;
  recommendations: string[];
}

export default function AIExplanation({ scanReportId, migrationId }: AIExplanationProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<MigrationExplanation | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanReportId,
          migrationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate explanation');
      }

      const data = await response.json();
      setExplanation(data.explanation);
      setRiskAssessment(data.riskAssessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI explanation');
    } finally {
      setLoading(false);
    }
  };

  if (explanation || riskAssessment) {
    return (
      <div className="space-y-6 border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-bold">AI Explanation</h3>
        </div>

        {/* Summary */}
        <div>
          <h4 className="font-semibold mb-2">Summary</h4>
          <p className="text-muted-foreground">{explanation?.summary}</p>
        </div>

        {/* Description */}
        <div>
          <h4 className="font-semibold mb-2">Description</h4>
          <p className="text-muted-foreground">{explanation?.description}</p>
        </div>

        {/* Risk Assessment */}
        {riskAssessment && (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Risk Assessment
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${
                riskAssessment.severity === 'critical' ? 'border-red-500/30 bg-red-500/10' :
                riskAssessment.severity === 'high' ? 'border-orange-500/30 bg-orange-500/10' :
                riskAssessment.severity === 'medium' ? 'border-yellow-500/30 bg-yellow-500/10' :
                'border-green-500/30 bg-green-500/10'
              }`}>
                <div className="text-sm text-muted-foreground mb-1">Severity</div>
                <div className="text-lg font-semibold capitalize">{riskAssessment.severity}</div>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground mb-1">Data Loss Risk</div>
                <div className="text-lg font-semibold flex items-center gap-2">
                  {riskAssessment.dataLossRisk ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <span className="text-red-500">Yes</span>
                    </>
                  ) : (
                    <span className="text-green-500">No</span>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-lg border border-border flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Estimated Downtime</div>
                  <div className="text-lg font-semibold">{riskAssessment.downtime}s</div>
                </div>
              </div>
              {riskAssessment.affectedRecords > 0 && (
                <div className="p-4 rounded-lg border border-border flex items-center gap-3">
                  <Database className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Affected Records</div>
                    <div className="text-lg font-semibold">{riskAssessment.affectedRecords.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Steps */}
        {explanation?.steps && explanation.steps.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Migration Steps</h4>
            <ol className="list-decimal list-inside space-y-2">
              {explanation.steps.map((step, index) => (
                <li key={index} className="text-muted-foreground">{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Recommendations */}
        {explanation?.recommendations && explanation.recommendations.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Recommendations</h4>
            <ul className="list-disc list-inside space-y-2">
              {explanation.recommendations.map((rec, index) => (
                <li key={index} className="text-muted-foreground">{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Rollback Plan */}
        {explanation?.rollbackPlan && (
          <div>
            <h4 className="font-semibold mb-2">Rollback Plan</h4>
            <p className="text-muted-foreground">{explanation.rollbackPlan}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-bold">AI Explanation</h3>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate AI Explanation
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
          <AlertTriangle className="w-5 h-5 inline mr-2" />
          {error}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Get an AI-powered explanation of this migration, including risk assessment, step-by-step breakdown, and recommendations.
      </p>
    </div>
  );
}

