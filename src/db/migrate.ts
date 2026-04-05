import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { db } from './index'

export function runMigrations(): void {
  migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') })
}
