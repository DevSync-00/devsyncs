# Quality Metrics

This directory contains tests and tools for tracking code quality metrics.

## Test Files

### 1. Complexity Metrics (`complexityMetrics.test.ts`)
- **Cyclomatic Complexity**: Measures the number of linearly independent paths through code
- **Cognitive Complexity**: Measures how difficult code is to understand
- **File Analysis**: Analyzes complexity metrics for entire files
- **Complexity Thresholds**: Identifies functions exceeding complexity limits

### 2. Maintainability Index (`maintainabilityIndex.test.ts`)
- **Maintainability Index Calculation**: Calculates maintainability score (0-100)
- **Halstead Volume**: Measures program complexity
- **File Analysis**: Analyzes maintainability of files
- **Rating System**: Classifies code as excellent, good, fair, or poor

### 3. Technical Debt Tracking (`technicalDebt.test.ts`)
- **Debt Detection**: Identifies TODO, FIXME, HACK, XXX comments
- **Code Smell Detection**: Detects common code smells
- **Severity Classification**: Classifies debt by severity (low, medium, high, critical)
- **Debt Summary**: Generates summary reports

### 4. Automated Code Review (`codeReview.test.ts`)
- **Code Review Rules**: Enforces coding standards
- **Issue Detection**: Identifies common code issues
- **Severity Filtering**: Filters issues by severity
- **Rule Enforcement**: Checks for hardcoded values, magic numbers, long lines, etc.

## Configuration Files

### `.eslintrc.json`
ESLint configuration with rules for:
- TypeScript best practices
- Code complexity limits
- Function length limits
- Import ordering
- Error handling requirements

### `.prettierrc.json`
Prettier configuration for consistent code formatting:
- Single quotes
- 2-space indentation
- 120 character line width
- Semicolons enabled

### `.husky/pre-commit`
Pre-commit hook that runs:
- Linting (`npm run lint`)
- Type checking (`npm run compile`)
- Tests (`npm run test`)

## Usage

### Run Quality Tests
```bash
npm run test
```

### Run Linting
```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

### Format Code
```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

### Run All Quality Checks
```bash
npm run quality
```

## Quality Metrics

### Complexity Thresholds
- **Cyclomatic Complexity**: Should be < 10 per function
- **Cognitive Complexity**: Should be < 8 per function
- **Function Length**: Should be < 50 lines
- **Max Depth**: Should be < 4 levels

### Maintainability Index
- **Excellent**: 80-100
- **Good**: 60-79
- **Fair**: 40-59
- **Poor**: 0-39

### Technical Debt Severity
- **Critical**: Security issues, critical bugs
- **High**: Important features, high priority fixes
- **Medium**: Medium priority improvements
- **Low**: Minor improvements, nice-to-haves

## Continuous Integration

Quality metrics are enforced through:
1. **Pre-commit hooks**: Run before each commit
2. **CI/CD pipeline**: Run on every push
3. **Automated reviews**: Check code quality automatically

