# Authentication Flow Implementation

## Overview

DevSync CLI now includes an interactive authentication and project selection flow that runs when any command is executed.

## Implementation Details

### New Features

1. **Interactive Authentication Prompt**
   - Users are prompted to choose between "Log in" or "Continue without login"
   - Appears at the start of every DevSync command

2. **Login Flow Integration**
   - If user selects "Log in", the existing `devsync login` flow is executed
   - After successful login, user is prompted for Project ID
   - Project metadata is fetched from DevSync backend

3. **Project Metadata Fetching**
   - Database connection string
   - Schema type (if available)
   - Other project information

4. **Manual Database Connection**
   - If user selects "Continue without login", they can manually enter database connection
   - Falls back to manual entry if project metadata fetch fails

5. **AI Analysis Always Enabled**
   - Codebase scanning always uses AI to infer schema from code patterns
   - No longer requires schema files

## Files Modified

### 1. `packages/cli/src/utils/prompts.ts` (NEW)
- Interactive prompt utilities using Node.js readline
- Functions:
  - `selectPrompt()` - Select from choices
  - `inputPrompt()` - Text input
  - `passwordPrompt()` - Hidden input
  - `confirmPrompt()` - Yes/No confirmation

### 2. `packages/cli/src/services/api-client.ts`
- Added `getProjectMetadata()` method
- Fetches project information from DevSync API
- Returns database connection string, schema type, and other metadata

### 3. `packages/cli/src/commands/scan.ts`
- Modified to show authentication prompt at start
- Integrated login flow
- Added project ID prompt and metadata fetching
- Always uses AI analysis for codebase scanning
- Handles both authenticated and non-authenticated flows

## User Flow

### Flow 1: User Selects "Log in"

```
1. User runs: devsync scan
2. Prompt: "How would you like to proceed?"
   - [1] Log in
   - [2] Continue without login
3. User selects: [1] Log in
4. Login flow executes (device authorization)
5. Prompt: "Enter your Project ID"
6. Fetch project metadata from API
7. Use database connection from project (or prompt if not found)
8. Scan codebase with AI analysis
9. Compare with database
```

### Flow 2: User Selects "Continue without login"

```
1. User runs: devsync scan
2. Prompt: "How would you like to proceed?"
   - [1] Log in
   - [2] Continue without login
3. User selects: [2] Continue without login
4. Prompt: "Enter database connection string"
5. Scan codebase with AI analysis
6. Compare with database
```

## API Endpoint

The implementation expects a DevSync API endpoint:

```
GET /api/projects/:projectId
```

**Response:**
```json
{
  "id": "project-uuid",
  "name": "Project Name",
  "databaseConnectionString": "postgresql://...",
  "schemaType": "prisma",
  ...
}
```

## Environment Variables

- `DEVSYNC_API_URL` - DevSync API URL (default: `http://localhost:4000`)
- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Ollama model to use (default: `llama3.2:3b`)
- `OPENAI_API_KEY` - OpenAI API key (if using OpenAI instead of Ollama)

## Example Usage

### With Login
```bash
$ devsync scan

🔍 Scanning codebase and database...

How would you like to proceed?

  1. Log in
  2. Continue without login

Select an option (1-2): 1

🔐 Logging in...
[Device authorization flow...]
✅ Device approved! DevSync CLI is now authenticated.

Enter your Project ID: abc-123-def-456

📡 Fetching project metadata...
✅ Found database connection in project settings
✅ Project "My Project" loaded

📁 Scanning codebase with AI analysis...
🤖 Using Ollama (local, free) for AI analysis...
   Model: llama3.2:3b
   URL: http://localhost:11434

✅ Code schema extracted (5 models)

🗄️  Scanning database...
✅ Database schema extracted (5 tables)

🔬 Comparing schemas...
✅ Comparison complete
```

### Without Login
```bash
$ devsync scan

🔍 Scanning codebase and database...

How would you like to proceed?

  1. Log in
  2. Continue without login

Select an option (1-2): 2

📝 Continuing without login...

Enter database connection string: postgresql://user:pass@localhost/db

📁 Scanning codebase with AI analysis...
🤖 Using Ollama (local, free) for AI analysis...
✅ Code schema extracted (5 models)

🗄️  Scanning database...
✅ Database schema extracted (5 tables)

🔬 Comparing schemas...
✅ Comparison complete
```

## Backward Compatibility

- Existing command-line flags still work (`--db`, `--project-id`, etc.)
- Config file support remains (`--config`)
- Non-interactive mode for CI/CD (use flags to skip prompts)

## Future Enhancements

- [ ] List user's projects when logged in (instead of requiring Project ID)
- [ ] Cache project metadata locally
- [ ] Support for multiple projects
- [ ] Project selection from list
- [ ] Skip prompts in non-interactive mode (CI/CD)

