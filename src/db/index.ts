import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

// Get the database URL from environment variable
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

export { db };
export type { User, NewUser, Keypair, NewKeypair, Alert, NewAlert, Order, NewOrder, Token, NewToken } from './schema';

// User operations
export const getUserByTelegramId = async (telegramId: number) => {
  const users = await db.select().from(schema.users).where(sql`telegram_id = ${telegramId}`).limit(1);
  return users[0];
};

export const createUser = async (telegramId: number) => {
  const [user] = await db.insert(schema.users).values({ telegramId }).returning();
  return user;
};

export const getAllUsers = async () => {
  return await db.select({ id: schema.users.id }).from(schema.users);
};

// Keypair operations
export const createKeypair = async (userId: number, publicKey: string, privateKey: string) => {
  const [keypair] = await db.insert(schema.keypairs)
    .values({ userId, publicKey, privateKey })
    .returning();
  return keypair;
};

export const getKeypairByUserId = async (userId: number) => {
  const keypairs = await db.select()
    .from(schema.keypairs)
    .where(sql`user_id = ${userId}`)
    .limit(1);
  return keypairs[0];
};

// Alert operations
export const createAlert = async (userId: number, symbol: string, price: number, condition: string) => {
  const [alert] = await db.insert(schema.alerts)
    .values({ userId, symbol, price, condition })
    .returning();
  return alert;
};

export const getUserAlerts = async (userId: number) => {
  return await db.select()
    .from(schema.alerts)
    .where(sql`user_id = ${userId} AND is_active = true`);
};

export const deactivateAlert = async (alertId: number) => {
  await db.update(schema.alerts)
    .set({ isActive: false })
    .where(sql`id = ${alertId}`);
};

export const getAllActiveAlerts = async () => {
  return await db.select()
    .from(schema.alerts)
    .where(sql`is_active = true`);
};

// Order operations
export const createOrder = async (
  userId: number,
  inputMint: string,
  inputSymbol: string,
  outputMint: string,
  price: number,
  amount: number
) => {
  const [order] = await db.insert(schema.orders)
    .values({ userId, inputMint, inputSymbol, outputMint, price, amount })
    .returning();
  return order;
};

export const getUserOrders = async (userId: number) => {
  return await db.select()
    .from(schema.orders)
    .where(sql`user_id = ${userId} AND is_active = true`);
};

export const getAllUserOrders = async (userId: number) => {
  return await db.select()
    .from(schema.orders)
    .where(sql`user_id = ${userId}`);
};

export const deactivateOrder = async (orderId: number) => {
  await db.update(schema.orders)
    .set({ isActive: false })
    .where(sql`id = ${orderId}`);
};

export const getAllActiveOrders = async () => {
  return await db.select()
    .from(schema.orders)
    .where(sql`is_active = true`);
}; 