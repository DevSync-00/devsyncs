import { adaptScannedToNormalized, diffSchemas, mergeSchemas } from '../components/erd/erd-adapter';
import { ScannedSchema } from '../lib/schema-scanner';
import { NormalizedSchema } from '../components/erd/types';

// Mock datasets for testing
const mockScannedDbSchema: ScannedSchema = {
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, constraints: ['PRIMARY KEY'] },
        { name: 'email', type: 'text', nullable: false, constraints: ['UNIQUE'] },
        { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()' }
      ],
      relationships: []
    },
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, constraints: ['PRIMARY KEY'] },
        { name: 'user_id', type: 'uuid', nullable: false },
        { name: 'title', type: 'text', nullable: false }
      ],
      relationships: [
        {
          column: 'user_id',
          referencedTable: 'users',
          referencedColumn: 'id',
          constraintName: 'fk_posts_users'
        }
      ]
    }
  ],
  metadata: {
    source: 'database',
    sourceType: 'postgres',
    tableCount: 2,
    columnCount: 6,
    scannedAt: new Date().toISOString()
  }
};

const mockScannedCodeSchema: ScannedSchema = {
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, constraints: ['PRIMARY KEY'] },
        { name: 'email', type: 'text', nullable: false, constraints: ['UNIQUE'] },
        { name: 'name', type: 'text', nullable: true } // New field in code
      ],
      relationships: []
    },
    // Missing 'posts' table in code schema (simulating deletion or uncreated state)
  ],
  metadata: {
    source: 'code',
    sourceType: 'prisma',
    tableCount: 1,
    columnCount: 3,
    scannedAt: new Date().toISOString()
  }
};

describe('Database ERD Visualizer Integration Test Suite', () => {
  
  describe('Schema Adapter (adaptScannedToNormalized)', () => {
    
    it('should translate ScannedSchema to NormalizedSchema format correctly', () => {
      const normalized = adaptScannedToNormalized(mockScannedDbSchema);
      
      expect(normalized.tables.length).toBe(2);
      expect(normalized.relationships.length).toBe(1);
      
      const usersTable = normalized.tables.find(t => t.name === 'users');
      expect(usersTable).toBeDefined();
      expect(usersTable?.schema).toBe('public');
      
      // Verify columns mapped correctly
      const idCol = usersTable?.columns.find(c => c.name === 'id');
      expect(idCol).toBeDefined();
      expect(idCol?.type.name).toBe('uuid');
      expect(idCol?.isPrimaryKey).toBe(true);
      expect(idCol?.nullable).toBe(false);
      
      const emailCol = usersTable?.columns.find(c => c.name === 'email');
      expect(emailCol?.isUnique).toBe(true);
      expect(emailCol?.isPrimaryKey).toBe(false);
    });

    it('should derive relationships and default cardinalities', () => {
      const normalized = adaptScannedToNormalized(mockScannedDbSchema);
      
      const relationship = normalized.relationships[0];
      expect(relationship).toBeDefined();
      expect(relationship.sourceTable).toBe('users');
      expect(relationship.targetTable).toBe('posts');
      expect(relationship.sourceColumn).toBe('id');
      expect(relationship.targetColumn).toBe('user_id');
      expect(relationship.targetCardinality).toBe('MANY'); // user_id is not unique in posts
    });

    it('should handle null/empty scanned schemas gracefully', () => {
      const emptyNormalized = adaptScannedToNormalized(null);
      expect(emptyNormalized.tables).toEqual([]);
      expect(emptyNormalized.relationships).toEqual([]);
    });
  });

  describe('Schema Diffing Engine (diffSchemas)', () => {
    
    it('should detect table additions and removals between schemas', () => {
      const codeN = adaptScannedToNormalized(mockScannedCodeSchema);
      const dbN = adaptScannedToNormalized(mockScannedDbSchema);
      
      // Compare: Code is 'before', DB is 'after'
      const diffs = diffSchemas(codeN, dbN);
      
      // 'posts' is present in DB (after) but missing in Code (before) -> Added table
      const addedTableDiff = diffs.find(d => d.target === 'table' && d.action === 'add');
      expect(addedTableDiff).toBeDefined();
      expect(addedTableDiff?.payload.name).toBe('posts');
      
      // 'name' column is present in Code (before) but missing in DB (after) -> Removed column
      const removedColDiff = diffs.find(d => d.target === 'column' && d.action === 'remove');
      expect(removedColDiff).toBeDefined();
      expect(removedColDiff?.payload.column).toBe('name');
      expect(removedColDiff?.payload.table).toBe('users');
    });

    it('should detect column changes', () => {
      const before: NormalizedSchema = {
        schemas: [],
        tables: [{
          id: '1',
          name: 'users',
          columns: [{ id: '1', name: 'age', type: { id: 'integer', name: 'integer' }, nullable: true }],
          indexes: [],
          constraints: []
        }],
        relationships: [],
        enums: [], customTypes: [], extensions: [], dependencies: []
      };

      const after: NormalizedSchema = {
        schemas: [],
        tables: [{
          id: '1',
          name: 'users',
          columns: [{ id: '1', name: 'age', type: { id: 'text', name: 'text' }, nullable: false }], // Type changed, nullable changed
          indexes: [],
          constraints: []
        }],
        relationships: [],
        enums: [], customTypes: [], extensions: [], dependencies: []
      };

      const diffs = diffSchemas(before, after);
      const changeDiff = diffs.find(d => d.target === 'column' && d.action === 'change');
      expect(changeDiff).toBeDefined();
      expect(changeDiff?.payload.column).toBe('age');
      expect(changeDiff?.payload.before.type.name).toBe('integer');
      expect(changeDiff?.payload.after.type.name).toBe('text');
    });
  });

  describe('Unified View Schema Merging (mergeSchemas)', () => {
    
    it('should combine code and database schemas into a unified union schema', () => {
      const codeN = adaptScannedToNormalized(mockScannedCodeSchema);
      const dbN = adaptScannedToNormalized(mockScannedDbSchema);
      
      const merged = mergeSchemas(codeN, dbN);
      
      // Union of tables: 'users' (exists in both) + 'posts' (exists in DB only)
      expect(merged.tables.length).toBe(2);
      
      const usersTable = merged.tables.find(t => t.name === 'users');
      // Union of columns: 'id', 'email', 'name' (code) + 'created_at' (db)
      expect(usersTable?.columns.length).toBe(4);
      expect(usersTable?.columns.some(c => c.name === 'name')).toBe(true);

      
      const postsTable = merged.tables.find(t => t.name === 'posts');
      expect(postsTable).toBeDefined();
    });
  });
});
