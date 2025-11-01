import { Client } from 'pg';
import type { DbSchema, Model, Field } from '../types/index.js';

export async function scanDatabase(connectionString: string): Promise<DbSchema> {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();

    // Get all tables in public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const models: Model[] = await Promise.all(
      tablesResult.rows.map(async (table) => {
        const tableName = table.table_name;
        
        // Get columns for this table
        const columnsResult = await client.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_name = $1
            AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName]);

        // Get constraints (primary keys, unique, foreign keys)
        const constraintsResult = await client.query(`
          SELECT
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_name = $1
            AND tc.table_schema = 'public'
        `, [tableName]);

        // Build constraints map
        const constraintsMap = new Map<string, string[]>();
        constraintsResult.rows.forEach((constraint) => {
          const columnName = constraint.column_name;
          if (!constraintsMap.has(columnName)) {
            constraintsMap.set(columnName, []);
          }
          constraintsMap.get(columnName)!.push(constraint.constraint_type);
        });

        const fields: Field[] = columnsResult.rows.map((col) => {
          let dataType = col.data_type;
          
          // Normalize data types
          if (dataType === 'character varying') {
            dataType = `varchar(${col.character_maximum_length || 255})`;
          } else if (dataType === 'character') {
            dataType = `char(${col.character_maximum_length || 1})`;
          } else if (dataType === 'numeric') {
            // Keep numeric as-is, could parse precision/scale if needed
            dataType = 'numeric';
          } else if (dataType === 'timestamp without time zone') {
            dataType = 'timestamp';
          } else if (dataType === 'timestamp with time zone') {
            dataType = 'timestamptz';
          }

          const field: Field = {
            name: col.column_name,
            type: dataType,
            nullable: col.is_nullable === 'YES',
            defaultValue: col.column_default
          };

          // Add constraints
          const constraints = constraintsMap.get(col.column_name);
          if (constraints && constraints.length > 0) {
            field.constraints = constraints;
          }

          return field;
        });

        return {
          name: tableName,
          fields
        };
      })
    );

    return {
      models,
      type: 'postgresql'
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scan database: ${error.message}`);
    }
    throw error;
  } finally {
    await client.end();
  }
}

