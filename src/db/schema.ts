import { pgTable, serial, integer, text, timestamp, boolean, real, jsonb } from 'drizzle-orm/pg-core';

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
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  mintAddress: text('mint_address').notNull().unique(),
  price: real('price').default(0),
  price1d: real('price_1d').default(0),
  price7d: real('price_7d').default(0),
  decimal: integer('decimal').notNull(),
  logoUrl: text('logo_url'),
  category: text('category'),
  subcategory: text('subcategory'),
  verified: boolean('verified').default(false),
  updateTime: integer('update_time'),
  currentSupply: text('current_supply'),
  marketCap: real('market_cap').default(0),
  tokenAmountVolume24h: real('token_amount_volume_24h').default(0),
  usdValueVolume24h: real('usd_value_volume_24h').default(0),
  createdAt: timestamp('created_at').defaultNow()
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