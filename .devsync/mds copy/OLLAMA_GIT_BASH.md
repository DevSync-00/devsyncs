# Ollama in Git Bash (Windows)

Since you're using **Git Bash** (not PowerShell), use these commands:

## Pull Model in Git Bash

### Option 1: Direct Windows path (easiest)
```bash
"C:/Users/Bereket/AppData/Local/Programs/Ollama/ollama.exe" pull llama3.2:3b
```

### Option 2: Git Bash path format
```bash
/c/Users/Bereket/AppData/Local/Programs/Ollama/ollama.exe pull llama3.2:3b
```

### Option 3: Check if model exists first
```bash
curl http://localhost:11434/api/tags

# If model not in list, pull it:
"C:/Users/Bereket/AppData/Local/Programs/Ollama/ollama.exe" pull llama3.2:3b
```

## Use DevSync with Ollama

Once you have a model, run:

```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --use-ollama \
  --ollama-model "llama3.2:3b" \
  --db "postgresql://postgres.lzvaidnvedhzpaczpxlk:HanibalMejbiri@aws-1-eu-north-1.pooler.supabase.com:5432/postgres" \
  --output .devsync/scan-results.json
```

## Note

- `$env:` is **PowerShell** syntax, not bash
- In Git Bash, use `/c/` for `C:\` or `"C:/"` format
- Git Bash automatically converts Windows paths with forward slashes


