# 🤖 Using Ollama (Free, Local AI)

Since OpenAI API can be expensive or have quota limits, DevSync now supports **Ollama** - a free, local AI service that runs on your machine!

## What is Ollama?

Ollama is a tool that lets you run large language models (LLMs) locally on your computer for free. It's perfect for development and testing.

## Setup

### 1. Install Ollama
& "$env:C:\Users\Bereket\AppData\Local\Programs\Ollama\ollama.exe" pull llama3.2:3b
**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from: https://ollama.com/download

### 2. Pull a Model

Recommended models (small, fast, good quality):

```bash
# Small & fast (recommended for schema analysis)
ollama pull llama3.2:3b

# Or slightly larger & better quality
ollama pull llama3.2:1b
ollama pull qwen2.5:3b
```

### 3. Start Ollama

Ollama runs as a local server. After installation, it should start automatically.

To verify it's running:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags
```

If it's not running:
```bash
# Start Ollama (usually auto-starts)
ollama serve
```

## Usage

### Basic Usage (Recommended)

```bash
# Use Ollama with default settings
devsync scan \
  --path . \
  --ai-analysis \
  --use-ollama \
  --db "postgresql://user:pass@host:port/database"
```

### Custom Model

```bash
# Use a specific model
devsync scan \
  --path . \
  --ai-analysis \
  --use-ollama \
  --ollama-model "qwen2.5:3b" \
  --db "postgresql://user:pass@host:port/database"
```

### Custom Ollama URL

If Ollama is running on a different port or remote server:

```bash
devsync scan \
  --path . \
  --ai-analysis \
  --use-ollama \
  --ollama-url "http://localhost:11434" \
  --db "postgresql://user:pass@host:port/database"
```

### Environment Variables

You can also set via environment variables:

```bash
export OLLAMA_URL="http://localhost:11434"
export OLLAMA_MODEL="llama3.2:3b"

devsync scan --path . --ai-analysis --use-ollama --db "postgresql://..."
```

## Recommended Models

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `llama3.2:3b` | ~2GB | ⚡⚡⚡ Fast | ✅ Good | **Recommended** |
| `qwen2.5:3b` | ~2GB | ⚡⚡⚡ Fast | ✅✅ Great | Best quality/speed |
| `llama3.2:1b` | ~1GB | ⚡⚡⚡⚡ Very Fast | ✅ Okay | Limited RAM |
| `mistral:7b` | ~4GB | ⚡⚡ Medium | ✅✅ Great | More powerful |

**For schema analysis, we recommend:**
- `llama3.2:3b` (default) - Good balance
- `qwen2.5:3b` - Slightly better quality

## Example

```bash
# Scan DevSync project using Ollama
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --use-ollama \
  --ollama-model "llama3.2:3b" \
  --db "postgresql://postgres.lzvaidnvedhzpaczpxlk:password@aws-1-eu-north-1.pooler.supabase.com:5432/postgres" \
  --output .devsync/scan-results.json
```

## Troubleshooting

### Ollama CLI Not Found (Windows)

**Error:** `ollama: command not found` but server is running

**Fix:**

**Option 1: Use full path**
```powershell
# Find Ollama (usually in one of these locations)
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull llama3.2:3b
& "$env:PROGRAMFILES\Ollama\ollama.exe" pull llama3.2:3b
```

**Option 2: Add to PATH**
```powershell
# Add to PATH temporarily
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"
ollama pull llama3.2:3b
```

**Option 3: Use Ollama Desktop App**
- Open Ollama Desktop app
- Use the UI to pull models
- Or find the executable path in app settings

**Option 4: Use API directly**
```powershell
# Pull model via API
Invoke-WebRequest -Uri "http://localhost:11434/api/pull" -Method POST -Body '{"name":"llama3.2:3b"}' -ContentType "application/json"
```

### Ollama Not Running

**Error:** `Ollama not available at http://localhost:11434`

**Fix:**
```bash
# Start Ollama
ollama serve

# Or check if it's running
curl http://localhost:11434/api/tags
```

### Model Not Found

**Error:** `Ollama API error: model not found`

**Fix:**
```bash
# Pull the model first
ollama pull llama3.2:3b

# Then verify it's available
ollama list
```

### Slow Performance

**Solutions:**
1. Use a smaller model: `llama3.2:1b`
2. Reduce file count (currently scans max 100 files)
3. Use pattern matching fallback (no AI)

### Out of Memory

**Solutions:**
1. Use a smaller model: `llama3.2:1b`
2. Close other applications
3. Reduce the number of files scanned

## Comparison: Ollama vs OpenAI

| Feature | Ollama | OpenAI |
|---------|--------|--------|
| **Cost** | ✅ Free | ❌ Pay per use |
| **Speed** | ⚡ Fast (local) | ⚡⚡ Very Fast (cloud) |
| **Privacy** | ✅✅ Fully local | ⚠️ Data sent to cloud |
| **Offline** | ✅ Works offline | ❌ Requires internet |
| **Quality** | ✅ Good | ✅✅ Excellent |
| **Setup** | ⚙️ Install & pull model | ✅ Just API key |

## Best Practices

1. **Start with Ollama** - Free and works well for schema analysis
2. **Use smaller models** - `llama3.2:3b` is perfect for this use case
3. **Keep Ollama running** - Start once, use many times
4. **Fallback to pattern matching** - If AI fails, pattern matching still works

---

**Note:** Ollama is great for development and testing. For production CI/CD, you might want to use OpenAI for faster, more reliable results.

