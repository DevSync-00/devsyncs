# Enhanced Authentication and Project Creation Flow

## Overview

DevSync CLI now includes a complete authentication and project management flow that guides users through login, project selection, and project creation.

## Implementation Details

### New Features

1. **Enhanced Login Flow**
   - Prompt: "Log in or create account"
   - Uses existing device authorization flow (handles both login and signup)
   - After successful authentication, proceeds to project selection

2. **Project Selection Flow**
   - Prompt: "Enter your Project ID (leave empty to create a new project)"
   - If Project ID provided: Fetches project metadata from backend
   - If empty: Triggers project creation flow

3. **Project Creation Flow**
   - Prompts for:
     - Project name (required)
     - Schema type (Prisma, Supabase, TypeORM, Kysely, Sequelize, Drizzle, Django, SQLAlchemy, Raw SQL, or Auto-detect)
     - Database connection string (required)
     - Codebase source (file path or git URL, defaults to current directory)
   - Creates project via DevSync API
   - Saves project ID and configuration to `.devsync/config.json`

4. **Automatic Config Management**
   - Saves project ID, name, database connection, and API credentials to config
   - Creates `.devsync/config.json` if it doesn't exist
   - Updates existing config with new project information

## User Flow

### Flow 1: Create New Project

```
1. User runs: devsync scan
2. Prompt: "How would you like to proceed?"
   - [1] Log in or create account
   - [2] Continue without login
3. User selects: [1] Log in or create account
4. Device authorization flow (login/signup in browser)
5. Prompt: "Enter your Project ID (leave empty to create a new project)"
6. User leaves empty (presses Enter)
7. Prompt: "Enter project name"
8. Prompt: "Select schema type" (with options)
9. Prompt: "Enter database connection string"
10. Prompt: "Enter codebase source (file path or git URL)" (defaults to current directory)
11. Project created via API
12. Config saved to .devsync/config.json
13. Continue with scanning...
```

### Flow 2: Use Existing Project

```
1. User runs: devsync scan
2. Prompt: "How would you like to proceed?"
   - [1] Log in or create account
   - [2] Continue without login
3. User selects: [1] Log in or create account
4. Device authorization flow
5. Prompt: "Enter your Project ID (leave empty to create a new project)"
6. User enters: "abc-123-def-456"
7. Fetch project metadata from API
8. Use database connection from project (or prompt if not found)
9. Continue with scanning...
```

### Flow 3: Continue Without Login

```
1. User runs: devsync scan
2. Prompt: "How would you like to proceed?"
   - [1] Log in or create account
   - [2] Continue without login
3. User selects: [2] Continue without login
4. Prompt: "Enter database connection string"
5. Continue with scanning (no cloud sync)...
```

## API Endpoints

### Get Project Metadata
```
GET /api/projects/:projectId
Authorization: Bearer <access_token>

Response:
{
  "id": "project-uuid",
  "name": "Project Name",
  "databaseConnectionString": "postgresql://...",
  "schemaType": "prisma",
  ...
}
```

### Create Project
```
POST /api/projects
Authorization: Bearer <access_token>
Content-Type: application/json

Request Body:
{
  "name": "My Project",
  "schemaType": "prisma", // optional
  "databaseConnectionString": "postgresql://...",
  "codebaseSource": "/path/to/codebase" // or git URL
}

Response:
{
  "id": "new-project-uuid",
  "name": "My Project",
  "databaseConnectionString": "postgresql://...",
  "schemaType": "prisma",
  ...
}
```

## Schema Type Options

When creating a new project, users can select from:

1. **Prisma** - `prisma`
2. **Supabase** - `supabase`
3. **TypeORM** - `typeorm`
4. **Kysely** - `kysely`
5. **Sequelize** - `sequelize`
6. **Drizzle** - `drizzle`
7. **Django** - `django`
8. **SQLAlchemy** - `sqlalchemy`
9. **Raw SQL** - `raw-sql`
10. **Auto-detect (AI)** - `auto` (uses AI to infer schema type)

## Config File Structure

After project creation, `.devsync/config.json` is created/updated:

```json
{
  "version": "1.0",
  "project": {
    "id": "project-uuid",
    "name": "My Project"
  },
  "database": {
    "connectionString": "postgresql://user:pass@host:5432/db"
  },
  "api": {
    "url": "http://localhost:4000",
    "key": "access-token-here"
  }
}
```

## Files Modified

### 1. `packages/cli/src/commands/scan.ts`
- Updated authentication prompt text
- Added project creation flow
- Added config file saving after project creation
- Enhanced project selection logic

### 2. `packages/cli/src/services/api-client.ts`
- Added `createProject()` method
- Creates new projects via DevSync API

## Example Usage

### Creating a New Project

```bash
$ devsync scan

🔍 Scanning codebase and database...

How would you like to proceed?

  1. Log in or create account
  2. Continue without login

Select an option (1-2): 1

🔐 Logging in or creating account...
[Device authorization flow...]
✅ Device approved! DevSync CLI is now authenticated.

Enter your Project ID (leave empty to create a new project): 

📝 Creating new project...

Enter project name: My Awesome Project

Select schema type

  1. Prisma
  2. Supabase
  3. TypeORM
  ...
  10. Auto-detect (AI)

Select an option (1-10): 10

Enter database connection string: postgresql://user:pass@localhost/db

Enter codebase source (file path or git URL) (default: /current/directory): 

📡 Creating project...
✅ Project "My Awesome Project" created successfully!
   Project ID: abc-123-def-456
   Config saved to: /current/directory/.devsync/config.json

📁 Scanning codebase with AI analysis...
🤖 Using Ollama (local, free) for AI analysis...
✅ Code schema extracted (5 models)

🗄️  Scanning database...
✅ Database schema extracted (5 tables)

🔬 Comparing schemas...
✅ Comparison complete
```

### Using Existing Project

```bash
$ devsync scan

🔍 Scanning codebase and database...

How would you like to proceed?

  1. Log in or create account
  2. Continue without login

Select an option (1-2): 1

🔐 Logging in or creating account...
✅ Device approved! DevSync CLI is now authenticated.

Enter your Project ID (leave empty to create a new project): abc-123-def-456

📡 Fetching project metadata...
✅ Found database connection in project settings
✅ Project "My Awesome Project" loaded

📁 Scanning codebase with AI analysis...
...
```

## Benefits

1. **Seamless Onboarding** - New users can create projects directly from CLI
2. **Project Management** - Easy project selection and switching
3. **Config Persistence** - Project settings saved automatically
4. **Flexible Schema Types** - Support for all 9 schema types plus auto-detect
5. **Backward Compatible** - Existing workflows still work with flags/config

## Future Enhancements

- [ ] List user's projects when logged in (instead of requiring Project ID)
- [ ] Project selection from interactive list
- [ ] Edit existing project settings
- [ ] Delete projects
- [ ] Project templates/presets

