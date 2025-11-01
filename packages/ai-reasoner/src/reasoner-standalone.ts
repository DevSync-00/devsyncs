// Standalone AI reasoner (works without package imports)
export interface Mismatch {
  type: 'missing_table' | 'missing_field' | 'type_mismatch' | 'extra_field' | 'constraint_mismatch';
  model: string;
  field?: string;
  codeValue?: any;
  dbValue?: any;
  severity: 'error' | 'warning' | 'info';
  suggestedFix?: string;
}

export interface MigrationExplanation {
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

export interface RiskAssessment {
  severity: 'low' | 'medium' | 'high' | 'critical';
  dataLossRisk: boolean;
  downtime: number;
  affectedRecords: number;
  recommendations: string[];
}

export class AIReasoner {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async explainMigration(
    mismatches: Mismatch[],
    codeSchema?: any,
    dbSchema?: any
  ): Promise<MigrationExplanation> {
    if (!this.apiKey || this.apiKey === '') {
      return this.generateTemplateExplanation(mismatches);
    }

    try {
      const prompt = this.buildMigrationExplanationPrompt(mismatches, codeSchema, dbSchema);
      const response = await this.callOpenAI(prompt);
      return this.parseMigrationExplanation(response);
    } catch (error) {
      console.error('AI explanation failed, using template:', error);
      return this.generateTemplateExplanation(mismatches);
    }
  }

  async assessRisk(
    mismatches: Mismatch[],
    codeSchema?: any,
    dbSchema?: any
  ): Promise<RiskAssessment> {
    if (!this.apiKey || this.apiKey === '') {
      return this.generateTemplateRiskAssessment(mismatches);
    }

    try {
      const prompt = this.buildRiskAssessmentPrompt(mismatches, codeSchema, dbSchema);
      const response = await this.callOpenAI(prompt);
      return this.parseRiskAssessment(response);
    } catch (error) {
      console.error('AI risk assessment failed, using template:', error);
      return this.generateTemplateRiskAssessment(mismatches);
    }
  }

  async query(
    question: string,
    mismatches: Mismatch[],
    codeSchema?: any,
    dbSchema?: any
  ): Promise<string> {
    if (!this.apiKey || this.apiKey === '') {
      return 'AI queries require an API key. Please configure OPENAI_API_KEY.';
    }

    try {
      const prompt = this.buildQueryPrompt(question, mismatches, codeSchema, dbSchema);
      const response = await this.callOpenAI(prompt);
      return response.choices[0]?.message?.content || 'No response from AI.';
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private buildMigrationExplanationPrompt(
    mismatches: Mismatch[],
    codeSchema?: any,
    dbSchema?: any
  ): string {
    return `You are a database migration expert. Analyze the following schema mismatches and provide a clear explanation.

Mismatches:
${JSON.stringify(mismatches, null, 2)}

Code Schema:
${codeSchema ? JSON.stringify(codeSchema, null, 2) : 'Not provided'}

Database Schema:
${dbSchema ? JSON.stringify(dbSchema, null, 2) : 'Not provided'}

Provide a JSON response with:
- summary: Brief one-line summary
- description: Detailed explanation
- steps: Array of migration steps
- riskLevel: low, medium, high, or critical
- dataLossRisk: boolean
- estimatedDowntime: number in seconds
- recommendations: Array of recommendations
- rollbackPlan: How to rollback these changes

Be specific about risks, especially for data loss or downtime.`;
  }

  private buildRiskAssessmentPrompt(
    mismatches: Mismatch[],
    codeSchema?: any,
    dbSchema?: any
  ): string {
    return `You are a database risk assessment expert. Analyze these schema mismatches and assess the risk.

Mismatches:
${JSON.stringify(mismatches, null, 2)}

Provide a JSON response with:
- severity: low, medium, high, or critical
- dataLossRisk: boolean
- downtime: number in seconds
- affectedRecords: estimated number (if applicable)
- recommendations: Array of safety recommendations`;
  }

  private buildQueryPrompt(
    question: string,
    mismatches: Mismatch[],
    codeSchema?: any,
    dbSchema?: any
  ): string {
    return `You are a database schema expert. Answer this question about the schema mismatches:

Question: ${question}

Mismatches:
${JSON.stringify(mismatches, null, 2)}

Code Schema:
${codeSchema ? JSON.stringify(codeSchema, null, 2) : 'Not provided'}

Database Schema:
${dbSchema ? JSON.stringify(dbSchema, null, 2) : 'Not provided'}

Provide a clear, helpful answer.`;
  }

  private async callOpenAI(prompt: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a database migration expert. Provide helpful, accurate explanations in JSON format when requested.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      try {
        const errorData: any = await response.json();
        errorMessage = errorData?.error?.message || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    return response.json();
  }

  private parseMigrationExplanation(response: any): MigrationExplanation {
    try {
      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : content;
      const parsed = JSON.parse(jsonContent);

      return {
        summary: parsed.summary || 'Migration explanation',
        description: parsed.description || '',
        steps: parsed.steps || [],
        riskLevel: parsed.riskLevel || 'medium',
        dataLossRisk: parsed.dataLossRisk || false,
        estimatedDowntime: parsed.estimatedDowntime || 0,
        affectedRecords: parsed.affectedRecords,
        recommendations: parsed.recommendations || [],
        rollbackPlan: parsed.rollbackPlan || 'Review migration SQL for rollback steps.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse AI response: ${message}`);
    }
  }

  private parseRiskAssessment(response: any): RiskAssessment {
    try {
      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : content;
      const parsed = JSON.parse(jsonContent);

      return {
        severity: parsed.severity || 'medium',
        dataLossRisk: parsed.dataLossRisk || false,
        downtime: parsed.downtime || 0,
        affectedRecords: parsed.affectedRecords || 0,
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse AI response: ${message}`);
    }
  }

  private generateTemplateExplanation(mismatches: Mismatch[]): MigrationExplanation {
    const errors = mismatches.filter(m => m.severity === 'error');
    const warnings = mismatches.filter(m => m.severity === 'warning');

    return {
      summary: `Migration for ${mismatches.length} mismatch(es)`,
      description: `This migration addresses ${errors.length} critical error(s) and ${warnings.length} warning(s) between your code schema and database schema.`,
      steps: mismatches.map(m => `Fix ${m.type}: ${m.model}${m.field ? '.' + m.field : ''}`),
      riskLevel: errors.length > 0 ? 'high' : 'low',
      dataLossRisk: mismatches.some(m => m.type === 'extra_field' || m.type === 'missing_table'),
      estimatedDowntime: errors.length > 0 ? 30 : 0,
      recommendations: [
        'Review the generated SQL before applying',
        'Test on a staging database first',
        'Backup your database before applying',
        'Apply during low-traffic periods if possible',
      ],
      rollbackPlan: 'Review the migration SQL for rollback statements. If no rollback is provided, manually revert the changes.',
    };
  }

  private generateTemplateRiskAssessment(mismatches: Mismatch[]): RiskAssessment {
    const errors = mismatches.filter(m => m.severity === 'error');
    const hasDataLoss = mismatches.some(m => m.type === 'extra_field' || m.type === 'missing_table');

    return {
      severity: errors.length > 0 ? 'high' : 'low',
      dataLossRisk: hasDataLoss,
      downtime: errors.length > 0 ? 30 : 0,
      affectedRecords: 0,
      recommendations: [
        'Test migration on staging first',
        'Backup database before applying',
        'Review all SQL statements carefully',
      ],
    };
  }
}

