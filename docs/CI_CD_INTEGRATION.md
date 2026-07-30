# CI/CD Integration Guide

## Overview

DevSync CLI is fully integrated with CI/CD pipelines! Use it in GitHub Actions, GitLab CI, CircleCI, and more.

## GitHub Actions

### Quick Start

1. **Add Workflow**:
   Copy `.github/workflows/devsync-scan.yml` to your repository

2. **Add Secrets**:
   - `DATABASE_URL` - PostgreSQL connection string
   - `DEVSYNC_API_URL` (optional) - Dashboard API URL
   - `DEVSYNC_API_KEY` (optional) - JWT token
   - `DEVSYNC_PROJECT_ID` (optional) - Project ID

3. **Trigger**:
   - Automatically runs on PRs with schema changes
   - Comments on PR with results
   - Sets status check

### Features

✅ **Automatic Scanning** - Runs on PRs  
✅ **PR Comments** - Shows mismatches in PR  
✅ **Status Checks** - Blocks merge on errors  
✅ **Migration Preview** - Shows suggested fixes  
✅ **Dashboard Sync** - Sends results to dashboard  

## Usage in CI/CD

### Basic Usage

```yaml
- name: Scan Schema
  run: |
    devsync scan \
      --path . \
      --db $DATABASE_URL \
      --json
```

### With Dashboard Sync

```yaml
- name: Scan and Sync
  run: |
    devsync scan \
      --path . \
      --db $DATABASE_URL \
      --project-id $DEVSYNC_PROJECT_ID \
      --api-url $DEVSYNC_API_URL \
      --api-key $DEVSYNC_API_KEY
```

### JSON Output Mode

```yaml
- name: Scan (JSON)
  run: |
    devsync scan \
      --path . \
      --db $DATABASE_URL \
      --json \
      --output scan-results.json
```

### Exit Codes

The CLI exits with:
- `0` - Success (no errors)
- `1` - Failure (errors found)

**Fail on warnings**:
```yaml
devsync scan --fail-on-warnings
```

## CLI Options for CI/CD

### `--json`
Output JSON format (for parsing in CI)

### `--output <path>`
Save results to JSON file

### `--fail-on-warnings`
Exit with error code on warnings (not just errors)

### `--no-sync`
Skip cloud sync (local only)

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success - No mismatches or only info-level |
| `1` | Failure - Errors found (or warnings if `--fail-on-warnings`) |

## Examples

### GitHub Actions

```yaml
name: DevSync Scan
on: [pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g @dev-sync/cli
      - run: |
          devsync scan \
            --db ${{ secrets.DATABASE_URL }} \
            --json
```

### GitLab CI

```yaml
devsync-scan:
  image: node:20
  script:
    - npm install -g @dev-sync/cli
    - devsync scan --db $DATABASE_URL --json
  only:
    - merge_requests
```

### CircleCI

```yaml
jobs:
  scan:
    docker:
      - image: cimg/node:20.0
    steps:
      - run: npm install -g @dev-sync/cli
      - run: devsync scan --db $DATABASE_URL --json
```

## Branch Protection

### Require DevSync Check

1. Go to repository → Settings → Branches
2. Add branch protection rule
3. Enable "Require status checks"
4. Select `devsync/schema-scan`

This **blocks merges** if schema mismatches are detected!

## PR Comments

The GitHub Action automatically comments on PRs with:
- Number of mismatches found
- Details of each mismatch
- Suggested fixes (SQL)
- Link to dashboard

## Best Practices

### ✅ Recommended:
- Use staging/test database in CI
- Review PR comments before merging
- Use status checks to block merges
- Keep database credentials secure (secrets)
- Test workflow on a branch first

### ⚠️ Avoid:
- Using production database directly
- Committing database passwords
- Disabling status checks
- Ignoring scan results

---

**Ready to integrate?** See `.github/workflows/devsync-scan.yml` for a complete example! 🚀

