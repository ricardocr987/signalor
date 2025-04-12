import { pgTable, serial, integer, text, timestamp, boolean, real, jsonb, bigint } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: integer('telegram_id').unique().notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const keypairs = pgTable('keypairs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  symbol: text('symbol').notNull(),
  price: real('price').notNull(),
  condition: text('condition').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow()
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  inputMint: text('input_mint').notNull(),
  inputSymbol: text('input_symbol').notNull(),
  outputMint: text('output_mint').notNull(),
  price: real('price').notNull(),
  amount: real('amount').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow()
});

export const tokens = pgTable('tokens', {
  mintAddress: text('mint_address').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  decimals: integer('decimals').notNull(),
  logoUrl: text('logo_url'),
  dailyVolume: real('daily_volume'),
  extensions: jsonb('extensions'),
  freezeAuthority: text('freeze_authority'),
  mintAuthority: text('mint_authority'),
  mintedAt: timestamp('minted_at'),
  permanentDelegate: text('permanent_delegate'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').defaultNow(),
  updateTime: bigint('update_time', { mode: 'number' })
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Keypair = typeof keypairs.$inferSelect;
export type NewKeypair = typeof keypairs.$inferInsert;

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert; 