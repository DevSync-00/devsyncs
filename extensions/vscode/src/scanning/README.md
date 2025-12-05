# Advanced Scanning System

Comprehensive database scanning system supporting all major database types and advanced scanning features.

## Features

### Database Support

- **PostgreSQL** - Full support including schemas, enums, arrays, JSON/JSONB
- **MySQL/MariaDB** - Full support including views, stored procedures, triggers
- **SQLite** - Full support including foreign keys, indexes, views
- **SQL Server** - Planned
- **Oracle** - Planned
- **MongoDB** - Planned
- **CockroachDB** - Planned
- **PlanetScale** - Planned
- **Supabase** - Planned
- **Neon** - Planned
- **Turso** - Planned
- **Xata** - Planned
- **D1** - Planned

### Advanced Scanning Features

1. **Incremental Scanning** - Only scan changed files since last scan
2. **Watch Mode** - Automatically scan when files change
3. **Scheduled Scans** - Automatic scans on schedule (cron or interval)
4. **Scan Profiles** - Different configurations for different environments
5. **Custom Scan Rules** - Define custom rules for ignoring/warning/error
6. **Scan Comparison** - Compare before/after scans
7. **Scan History** - Timeline of all scans with metadata

## Architecture

### Database Abstraction Layer

```
DatabaseParserRegistry
    ↓
IDatabaseParser (interface)
    ↓
Database-specific Parsers
    ↓
Unified DatabaseSchema
```

### Schema Types

All database schemas are normalized to a unified `DatabaseSchema` format:

- **Tables** - With columns, constraints, indexes
- **Views** - With definitions
- **Enums** - With values
- **Functions** - With parameters and return types
- **Triggers** - With timing and events

### Type System

- **ColumnType** - Normalized type representation
- **TypeCategory** - Categories (string, number, boolean, date, etc.)
- **TypeParameters** - Length, precision, scale, etc.

## Usage

### Basic Scanning

```typescript
import { getDefaultParserRegistry } from './scanning/database/parsers';
import { AdvancedScanner } from './scanning/advanced/advancedScanner';

const registry = getDefaultParserRegistry();
const scanner = new AdvancedScanner(registry);

const profile: ScanProfile = {
  name: 'production',
  database: {
    type: DatabaseType.PostgreSQL,
    connectionString: 'postgresql://user:pass@localhost/db',
  },
  schemaFiles: ['schema.prisma'],
};

const result = await scanner.performScan(profile);
```

### Incremental Scanning

```typescript
const previousScanId = 'scan-123';
const result = await scanner.incrementalScan(profile, previousScanId);
```

### Watch Mode

```typescript
scanner.startWatchMode(profile, (result) => {
  console.log('Scan completed:', result.mismatches.length);
});
```

### Scheduled Scans

```typescript
scanner.scheduleScan(profile, {
  expression: 'every 1 hour',
}, (result) => {
  console.log('Scheduled scan completed');
});
```

### Scan Comparison

```typescript
const comparison = scanner.compareScans('scan-1', 'scan-2');
console.log('Added:', comparison.added.length);
console.log('Removed:', comparison.removed.length);
```

## Dependencies

### Required

- `pg` - PostgreSQL client
- `mysql2` - MySQL/MariaDB client
- `sqlite3` - SQLite client

### Installation

```bash
npm install pg mysql2 sqlite3
npm install --save-dev @types/pg @types/mysql2 @types/sqlite3
```

## Extension Points

### Adding New Database Parser

1. Implement `IDatabaseParser` interface
2. Register parser in `initializeParserRegistry()`
3. Add database type to `DatabaseType` enum
4. Add capabilities to `DatabaseCapabilities`

Example:

```typescript
export class SQLServerParser implements IDatabaseParser {
  readonly databaseType = DatabaseType.SQLServer;
  
  async parseFromConnection(connection: DatabaseConnection): Promise<DatabaseSchema> {
    // Implementation
  }
  
  // ... other methods
}
```

## Future Enhancements

- [ ] SQL Server parser
- [ ] Oracle parser
- [ ] MongoDB parser
- [ ] CockroachDB parser
- [ ] Cloud database parsers (PlanetScale, Supabase, Neon, etc.)
- [ ] Prisma schema parser
- [ ] TypeORM entity parser
- [ ] Sequelize model parser
- [ ] Django model parser
- [ ] SQLAlchemy model parser
- [ ] Schema inference from code patterns

