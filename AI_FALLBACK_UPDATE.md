# AI Analysis as Automatic Fallback - Update

## What Changed

DevSync now **automatically uses AI analysis** when no schema files are found, instead of requiring users to explicitly pass `--ai-analysis`.

## How It Works Now

### Before (Old Behavior)
1. Look for schema files (Prisma, Supabase migrations, etc.)
2. If none found → **Error: "No schema file found"**
3. User must manually add `--ai-analysis` flag

### After (New Behavior)
1. Look for schema files (Prisma, Supabase migrations, etc.)
2. If none found → **Automatically try AI analysis** (if Ollama or OpenAI available)
3. Only error if both schema files AND AI analysis fail

## Implementation Details

### Modified Files

1. **`packages/cli/src/services/code-scanner.ts`**
   - Added fallback logic at the end of `scanCodebase()`
   - When no schema files found, automatically checks for AI availability
   - Tries Ollama first (free, local), then OpenAI
   - Only throws error if AI is unavailable or fails

2. **`packages/cli/src/commands/scan.ts`**
   - Always passes AI credentials to `scanCodebase()` (even if not explicitly using AI)
   - Allows fallback to work automatically

## Usage Examples

### Automatic AI Fallback (New!)

```bash
# No schema files, but Ollama is running → automatically uses AI
devsync scan --db postgresql://...

# No schema files, but OPENAI_API_KEY is set → automatically uses AI
devsync scan --db postgresql://...

# No schema files, no AI available → shows helpful error
devsync scan --db postgresql://...
```

### Explicit AI Usage (Still Works)

```bash
# Explicitly request AI analysis
devsync scan --ai-analysis --use-ollama --db postgresql://...
devsync scan --ai-analysis --openai-api-key sk-... --db postgresql://...
```

## Benefits

1. **Works out of the box** - No need to create migration files just to scan
2. **Better developer experience** - Automatically infers schema from code
3. **Backward compatible** - Still works with schema files (tries those first)
4. **Smart fallback** - Only uses AI when needed

## AI Detection Priority

When no schema files found, DevSync checks for AI in this order:

1. **Ollama** (preferred - free, local)
   - Checks `--use-ollama` flag
   - Checks `OLLAMA_URL` environment variable
   - Defaults to `http://localhost:11434` if available

2. **OpenAI** (fallback)
   - Checks `--openai-api-key` flag
   - Checks `OPENAI_API_KEY` environment variable

3. **Error** (if neither available)
   - Shows helpful error message with tips

## Error Messages

### Before
```
❌ Error: No schema file found. Looking for:
  - prisma/schema.prisma
  - supabase/migrations/*.sql
  ...
Tip: Use --ai-analysis to infer schema from code patterns
```

### After (if AI available but failed)
```
⚠️  AI analysis failed: [error message]
❌ Error: No schema file found...
💡 AI analysis was attempted but couldn't infer schema. 
   Check that your code contains database queries.
```

### After (if AI unavailable)
```
❌ Error: No schema file found...
💡 Tip: Use --ai-analysis (with --use-ollama or --openai-api-key) 
   to infer schema from code patterns
```

## Testing

To test the new behavior:

1. **Create a project without schema files:**
   ```bash
   mkdir test-project
   cd test-project
   # Add some code with database queries
   ```

2. **Run scan with Ollama:**
   ```bash
   # Make sure Ollama is running
   ollama serve
   
   # In another terminal
   devsync scan --db postgresql://...
   # Should automatically use AI!
   ```

3. **Run scan with OpenAI:**
   ```bash
   export OPENAI_API_KEY=sk-...
   devsync scan --db postgresql://...
   # Should automatically use AI!
   ```

## Migration Guide

No breaking changes! Existing workflows continue to work:

- ✅ Projects with schema files → Works as before
- ✅ Projects using `--ai-analysis` → Works as before
- ✅ Projects without schema files → **Now automatically uses AI** (if available)

## Future Improvements

- [ ] Add `--no-ai-fallback` flag to disable automatic AI
- [ ] Better error messages when AI fails
- [ ] Cache AI results more intelligently
- [ ] Support for more AI providers

