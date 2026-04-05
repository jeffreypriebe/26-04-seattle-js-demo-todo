import { sqliteTable, integer, text, uniqueIndex, primaryKey, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)]
)

export const todos = sqliteTable(
  'todos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('todos_user_id_idx').on(table.userId)],
)

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const teamTasks = sqliteTable(
  'team_tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('team_tasks_team_id_idx').on(table.teamId),
    index('team_tasks_created_by_user_id_idx').on(table.createdByUserId),
  ],
)

export const teamMembers = sqliteTable(
  'team_members',
  {
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    userId: integer('user_id').notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.userId] })],
)
