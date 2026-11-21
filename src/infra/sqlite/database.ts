import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { SQLITE_SCHEMA_SQL } from './schema';

let sqlModulePromise: Promise<SqlJsStatic> | null = null;

function isVitestEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    Boolean(process.env?.VITEST || process.env?.NODE_ENV === 'test')
  );
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs(
      isVitestEnv()
        ? {
            locateFile: (file: string) => `node_modules/sql.js/dist/${file}`,
          }
        : {
            locateFile: () => wasmUrl,
          },
    );
  }
  return sqlModulePromise;
}

export type SqlParams = SqlValue[];

export class SqliteDatabase {
  private db: Database;

  private constructor(db: Database) {
    this.db = db;
    this.db.run('PRAGMA foreign_keys = ON;');
  }

  static async open(initialBytes?: Uint8Array | null): Promise<SqliteDatabase> {
    const SQL = await getSqlJs();
    const db = initialBytes ? new SQL.Database(initialBytes) : new SQL.Database();
    const instance = new SqliteDatabase(db);
    instance.exec(SQLITE_SCHEMA_SQL);
    return instance;
  }

  exec(sql: string): void {
    this.db.run(sql);
  }

  run(sql: string, params: SqlParams = []): void {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      stmt.step();
    } finally {
      stmt.free();
    }
  }

  all<T = Record<string, SqlValue>>(sql: string, params: SqlParams = []): T[] {
    const stmt = this.db.prepare(sql);
    const rows: T[] = [];
    try {
      stmt.bind(params);
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  get<T = Record<string, SqlValue>>(
    sql: string,
    params: SqlParams = [],
  ): T | null {
    const rows = this.all<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.db.run('COMMIT;');
      return result;
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
  }

  exportBytes(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}
