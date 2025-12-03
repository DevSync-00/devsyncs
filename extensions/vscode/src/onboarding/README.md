# Onboarding Experience

This module provides a comprehensive onboarding experience for new DevSync users, including an interactive setup wizard, automatic schema detection, database connection testing, and quick start templates.

## Features

### 1. Interactive Setup Wizard

The `OnboardingWizard` guides users through initial configuration with:

- **Step-by-step setup**: Progressive disclosure of configuration options
- **Visual progress indicator**: Shows completion percentage
- **Validation**: Real-time validation with helpful error messages
- **Skip/Retry options**: Users can skip optional steps or retry failed ones
- **State persistence**: Remembers where users left off

### 2. Prisma Schema Auto-Detection

The `PrismaSchemaDetector` automatically finds Prisma schema files:

- **Common locations**: Checks standard paths (prisma/schema.prisma, schema.prisma, etc.)
- **Recursive search**: Searches workspace directories (with depth limit)
- **Multiple schemas**: Supports projects with multiple schema files
- **Validation**: Validates that detected files are valid Prisma schemas

### 3. Database Connection Testing

The `DatabaseConnectionTester` validates database connections:

- **Format validation**: Checks connection string format
- **Protocol support**: Supports PostgreSQL, MySQL, SQLite, MongoDB, SQL Server
- **Timeout handling**: Tests with configurable timeout
- **Environment variables**: Can read from common env vars (DATABASE_URL, etc.)

### 4. Quick Start Templates

The `QuickStartManager` provides ready-to-use templates:

- **Basic Prisma Setup**: Simple schema with User model
- **DevSync Configuration**: Pre-configured DevSync settings
- **Full Stack Template**: Complete setup with relationships
- **Custom templates**: Users can create templates from existing projects

## Usage

### Starting the Onboarding Wizard

```typescript
import { OnboardingWizard } from './onboarding';
import { PrismaSchemaDetector } from './onboarding';
import { DatabaseConnectionTester } from './onboarding';

const wizard = new OnboardingWizard(
  context,
  configManager,
  new PrismaSchemaDetector(),
  new DatabaseConnectionTester()
);

await wizard.start();
```

### Detecting Prisma Schemas

```typescript
const detector = new PrismaSchemaDetector();
const schemaPath = await detector.detect();
if (schemaPath) {
  console.log(`Found schema at: ${schemaPath}`);
}
```

### Testing Database Connection

```typescript
const tester = new DatabaseConnectionTester();
const result = await tester.test('postgresql://user:pass@localhost:5432/db');
if (result.success) {
  console.log('Connection successful!');
} else {
  console.error(`Connection failed: ${result.error}`);
}
```

### Applying Quick Start Templates

```typescript
const manager = new QuickStartManager();
const template = await manager.showTemplateSelection();
if (template) {
  await manager.applyTemplate(template);
}
```

## Wizard Steps

1. **Welcome**: Introduction and overview
2. **Detect Schema**: Auto-detect Prisma schema files
3. **API Configuration**: Set up API URL and project ID
4. **Database Connection**: Test database connection string
5. **Feature Selection**: Choose which features to enable
6. **Complete**: Save configuration and show next steps

## Integration

The onboarding wizard is automatically triggered on first activation if onboarding hasn't been completed. Users can also manually start it via the command palette:

- `DevSync: Start Onboarding`
- `DevSync: Restart Onboarding`

## Configuration

Onboarding completion status is stored in VS Code's global state:

```typescript
context.globalState.get<boolean>('devsync.onboarding.completed', false);
```

## Future Enhancements

- Video tutorials embedded in wizard steps
- Interactive tutorials for first-time users
- Feature discovery tooltips
- Contextual help based on user actions
- Analytics to improve onboarding flow

