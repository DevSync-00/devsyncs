# Release automation (Release Please)

## GitHub Actions permission (required for org repos)

If Release Please fails with:

> GitHub Actions is not permitted to create or approve pull requests

enable this in the repository or organization:

1. **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, choose **Read and write permissions**
3. Enable **Allow GitHub Actions to create and approve pull requests**

Alternatively, create a fine-grained or classic PAT with `contents` and `pull_requests` scope, store it as repository secret `RELEASE_PLEASE_TOKEN`, and point the workflow at that token.

## Conventional commits (recommended)

Release Please parses commit messages. Prefer:

- `feat:` minor version bump
- `fix:` patch version bump
- `feat!:` or `fix!:` breaking change (major)

Examples:

```
feat(cli): add migrate command
fix(dashboard): correct ESLint CI setup
chore: update dependencies
```

Merge commits and free-form messages are skipped (warnings only).

## First release

On first run, Release Please creates release PRs per package (`cli`, `vscode-extension`, `dashboard`, `ai-reasoner`) from manifest version `0.1.0` and proposes `0.2.0` based on conventional commits since the beginning of history.

After merging a release PR, tags like `cli-v0.2.0` are created automatically.
