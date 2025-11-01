# @devsync/ai-reasoner

AI-powered migration explanation and risk assessment for DevSync.

## Features

- ✅ Migration explanation generation
- ✅ Risk assessment (severity, data loss, downtime)
- ✅ Natural language query support
- ✅ Template fallback (works without API key)

## Installation

```bash
npm install @devsync/ai-reasoner
```

## Usage

```typescript
import { AIReasoner } from '@devsync/ai-reasoner';

const reasoner = new AIReasoner(process.env.OPENAI_API_KEY);

// Explain migration
const explanation = await reasoner.explainMigration(mismatches, codeSchema, dbSchema);
console.log(explanation.summary);
console.log(explanation.description);
console.log(explanation.riskLevel);

// Assess risk
const risk = await reasoner.assessRisk(mismatches, codeSchema, dbSchema);
console.log(risk.severity);
console.log(risk.dataLossRisk);

// Query AI
const answer = await reasoner.query(
  "What's the safest way to apply this migration?",
  mismatches,
  codeSchema,
  dbSchema
);
console.log(answer);
```

## Configuration

**Required** (for AI features):
- `OPENAI_API_KEY` - OpenAI API key

**Optional**:
- `OPENAI_BASE_URL` - Custom OpenAI API endpoint (default: https://api.openai.com/v1)

## Features

### Migration Explanation

Provides:
- Summary of migration
- Detailed description
- Step-by-step breakdown
- Risk assessment
- Recommendations
- Rollback plan

### Risk Assessment

Assesses:
- Severity level (low/medium/high/critical)
- Data loss risk (boolean)
- Estimated downtime (seconds)
- Affected records (estimated)
- Safety recommendations

### Natural Language Queries

Ask questions about:
- Migration safety
- Rollback procedures
- Risk assessment
- Schema mismatches

## Template Fallback

If no API key is provided, the service uses template-based explanations:
- Basic risk assessment
- Standard recommendations
- Simple explanations

This ensures the service works even without OpenAI API.

## License

MIT

