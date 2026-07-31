# Open VSX Namespace Ownership

This repository is the official source repository for the **Dev-Sync Schema
Guard** extension published in the Open VSX Registry.

## Namespace

- Namespace: `Dev-sync`
- Extension identifier: `Dev-sync.devsync`
- Open VSX listing: <https://open-vsx.org/extension/Dev-sync/devsync>
- Current release: `0.1.4`

## Ownership chain

The namespace and extension are connected to this repository through the
extension manifest at
[`extensions/vscode/package.json`](extensions/vscode/package.json):

```json
{
  "name": "devsync",
  "displayName": "Dev-Sync Schema Guard",
  "publisher": "Dev-sync",
  "repository": {
    "type": "git",
    "url": "https://github.com/DevSync-00/devsyncs.git",
    "directory": "extensions/vscode"
  },
  "homepage": "https://www.dev-sync.dev"
}
```

The same repository contains the source for:

- the VS Code and Open VSX extension in `extensions/vscode`;
- the Dev-Sync CLI in `packages/cli`;
- the official Dev-Sync dashboard deployed at <https://www.dev-sync.dev>.

## Ownership statement

The maintainers of the
[`DevSync-00/devsyncs`](https://github.com/DevSync-00/devsyncs) repository
control and maintain:

1. the Open VSX namespace `Dev-sync`;
2. the Open VSX extension `Dev-sync.devsync`;
3. the Dev-Sync source code in this repository; and
4. the official Dev-Sync website at <https://www.dev-sync.dev>.

The namespace is used exclusively for official Dev-Sync extensions.

## Open VSX request

We request that the Open VSX administrators grant namespace ownership of
`Dev-sync` to the Open VSX account associated with the GitHub maintainer
submitting the namespace claim.

For verification questions, please use the public namespace-claim issue or the
repository issue tracker:
<https://github.com/DevSync-00/devsyncs/issues>.

