/**
 * SQLite database schema parser.
 */

import { IDatabaseParser } from '../parser';
import { DatabaseType, DatabaseConnection } from '../types';
import { DatabaseSchema, Table, Column, ColumnType, TypeCategory } from '../../schema/types';
// Optional dependency - install with: npm install sqlite3
// @ts-ignore - Optional dependency
import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

export class SQLiteParser implements IDatabaseParser {
  readonly databaseType = DatabaseType.SQLite;
  
  async parseFromConnection(connection: DatabaseConnection): Promise<DatabaseSchema> {
    const dbPath = this.extractPath(connection.connectionString);
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.parseSchema(db)
          .then(resolve)
          .catch(reject)
          .finally(() => db.close());
      });
    });
  }
  
  async parseFromSQL(sql: string): Promise<DatabaseSchema> {
    throw new Error('SQL parsing not yet implemented for SQLite');
  }
  
  async parseFromConnectionString(connectionString: string): Promise<DatabaseSchema> {
    return this.parseFromConnection({
      type: DatabaseType.SQLite,
      connectionString,
    });
  }
  
  validateConnectionString(connectionString: string): boolean {
    return connectionString.startsWith('sqlite://') || 
           connectionString.startsWith('file:') ||
           (connectionString.endsWith('.db') || connectionString.endsWith('.sqlite') || connectionString.endsWith('.sqlite3'));
  }
  
  private extractPath(connectionString: string): string {
    if (connectionString.startsWith('sqlite://')) {
      return connectionString.replace('sqlite://', '');
    }
    if (connectionString.startsWith('file:')) {
      return connectionString.replace('file:', '');
    }
    return connectionString;
  }
  
  private async parseSchema(db: sqlite3.Database): Promise<DatabaseSchema> {
    const tables = await this.parseTables(db);
    const views = await this.parseViews(db);
    const indexes = await this.parseAllIndexes(db);
    
    return {
      databaseType: DatabaseType.SQLite,
      tables,
      views,
    };
  }
  
  private async parseTables(db: sqlite3.Database): Promise<Table[]> {
    return new Promise((resolve, reject) => {
      db.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'", (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        Promise.all(rows.map(row => this.parseTable(db, row.name, row.sql)))
          .then(resolve)
          .catch(reject);
      });
    });
  }
  
  private async parseTable(db: sqlite3.Database, tableName: string, createSql?: string): Promise<Table> {
    const columns = await this.parseColumns(db, tableName);
    const primaryKey = await this.parsePrimaryKey(db, tableName);
    const foreignKeys = await this.parseForeignKeys(db, tableName);
    const indexes = await this.parseIndexes(db, tableName);
    
    return {
      name: tableName,
      columns,
      primaryKey,
      foreignKeys,
      indexes,
    };
  }
  
  private async parseColumns(db: sqlite3.Database, tableName: string): Promise<Column[]> {
    return new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(${tableName})`, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const columns: Column[] = rows.map((row: any) => {
          const type = this.parseColumnType(row.type);
          
          return {
            name: row.name,
            type,
            nullable: !row.notnull,
            defaultValue: row.dflt_value || undefined,
            autoIncrement: false, // SQLite doesn't have auto_increment, uses INTEGER PRIMARY KEY
            position: row.cid,
          };
        });
        
        resolve(columns);
      });
    });
  }
  
  private parseColumnType(typeString: string): ColumnType {
    const upper = typeString.toUpperCase();
    let category: TypeCategory;
    let name: string;
    
    // Integer types
    if (upper.includes('INT')) {
      category = TypeCategory.Integer;
      name = 'integer';
    }
    // Text types
    else if (upper.includes('TEXT') || upper.includes('CHAR') || upper.includes('CLOB')) {
      category = TypeCategory.String;
      name = 'text';
    }
    // Real/Float types
    else if (upper.includes('REAL') || upper.includes('FLOA') || upper.includes('DOUB')) {
      category = TypeCategory.Float;
      name = 'real';
    }
    // Blob types
    else if (upper.includes('BLOB')) {
      category = TypeCategory.Binary;
      name = 'blob';
    }
    // Numeric (can be integer or real)
    else if (upper.includes('NUMERIC')) {
      category = TypeCategory.Decimal;
      name = 'numeric';
    }
    else {
      category = TypeCategory.Other;
      name = typeString.toLowerCase();
    }
    
    return { name, originalName: typeString, category };
  }
  
  private async parsePrimaryKey(db: sqlite3.Database, tableName: string): Promise<{ columns: string[] } | undefined> {
    return new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(${tableName})`, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const pkColumns = rows.filter((r: any) => r.pk === 1).map((r: any) => r.name);
        resolve(pkColumns.length > 0 ? { columns: pkColumns } : undefined);
      });
    });
  }
  
  private async parseForeignKeys(db: sqlite3.Database, tableName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(`PRAGMA foreign_key_list(${tableName})`, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const foreignKeys: Map<string, any> = new Map();
        
        for (const row of rows) {
          const id = row.id;
          if (!foreignKeys.has(id.toString())) {
            foreignKeys.set(id.toString(), {
              name: `fk_${tableName}_${id}`,
              columns: [],
              referencedTable: row.table,
              referencedColumns: [],
              onDelete: row.on_delete || undefined,
              onUpdate: row.on_update || undefined,
            });
          }
          
          const fk = foreignKeys.get(id.toString())!;
          fk.columns.push(row.from);
          fk.referencedColumns.push(row.to);
        }
        
        resolve(Array.from(foreignKeys.values()));
      });
    });
  }
  
  private async parseIndexes(db: sqlite3.Database, tableName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(`PRAGMA index_list(${tableName})`, (err: Error | null, indexRows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        Promise.all(indexRows.map(async (indexRow: any) => {
          const indexName = indexRow.name;
          const isUnique = indexRow.unique === 1;
          
          return new Promise<any>((resolveIndex, rejectIndex) => {
            db.all(`PRAGMA index_info(${indexName})`, (errInfo: Error | null, infoRows: any[]) => {
              if (errInfo) {
                rejectIndex(errInfo);
                return;
              }
              
              resolveIndex({
                name: indexName,
                columns: infoRows.map((r: any) => ({ name: r.name })),
                unique: isUnique,
              });
            });
          });
        }))
          .then(resolve)
          .catch(reject);
      });
    });
  }
  
  private async parseViews(db: sqlite3.Database): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all("SELECT name, sql FROM sqlite_master WHERE type = 'view'", (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(rows.map((r: any) => ({
          name: r.name,
          definition: r.sql,
        })));
      });
    });
  }
  
  private async parseAllIndexes(db: sqlite3.Database): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'", (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve([]); // Indexes are parsed per-table
      });
    });
  }
}

