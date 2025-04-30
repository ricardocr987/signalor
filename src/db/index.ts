import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq, and } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { JupiterService } from '../services/jup';

// Get the database URL from environment variable
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Helper function to ensure user exists
async function ensureUserExists(userId: number) {
  const existingUser = await db.select().from(schema.users).where(eq(schema.users.telegramId, userId));
  if (!existingUser.length) {
    await db.insert(schema.users).values({ telegramId: userId });
  }
  return (await db.select().from(schema.users).where(eq(schema.users.telegramId, userId)))[0];
}

// User operations
export const getUserByTelegramId = async (telegramId: number) => {
  try {
    const users = await db.select().from(schema.users).where(eq(schema.users.telegramId, telegramId));
    return users[0];
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

export const getUserTelegramId = async (userId: number) => {
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  return user[0].telegramId;
};

export const createUser = async (telegramId: number) => {
  try {
    const [user] = await db.insert(schema.users)
      .values({ telegramId })
      .returning();
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    return await db.select({ id: schema.users.id }).from(schema.users);
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Keypair operations
export const createKeypair = async (userId: number, publicKey: string, privateKey: string) => {
  try {
    const dbUser = await ensureUserExists(userId);
    const [keypair] = await db.insert(schema.keypairs)
      .values({ userId: dbUser.id, publicKey, privateKey })
      .returning();
    return keypair;
  } catch (error) {
    console.error('Error creating keypair:', error);
    throw error;
  }
};

export const getKeypairByUserId = async (userId: number) => {
  try {
    const dbUser = await ensureUserExists(userId);
    const keypairs = await db.select()
      .from(schema.keypairs)
      .where(eq(schema.keypairs.userId, dbUser.id));
    return keypairs[0];
  } catch (error) {
    console.error('Error getting keypair:', error);
    throw error;
  }
};

// Alert operations
export const createAlert = async (userId: number, symbol: string, price: number, condition: string) => {
  try {
    const dbUser = await ensureUserExists(userId);
    const [alert] = await db.insert(schema.alerts)
      .values({ userId: dbUser.id, symbol, price, condition })
      .returning();
    return alert;
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
};

export const getAlertById = async (id: number) => {
  try {
    return await db.select()
      .from(schema.alerts)
      .where(eq(schema.alerts.id, id));
  } catch (error) {
    console.error('Error getting alert by id:', error);
    throw error;
  }
};

export const getUserAlerts = async (userId: number) => {
  try {
    const dbUser = await ensureUserExists(userId);
    return await db.select()
      .from(schema.alerts)
      .where(and(
        eq(schema.alerts.userId, dbUser.id),
        eq(schema.alerts.isActive, true)
      ));
  } catch (error) {
    console.error('Error getting user alerts:', error);
    throw error;
  }
};

export const deactivateAlert = async (alertId: number) => {
  try {
    await db.update(schema.alerts)
      .set({ isActive: false })
      .where(eq(schema.alerts.id, alertId));
  } catch (error) {
    console.error('Error deactivating alert:', error);
    throw error;
  }
};

export const getAllActiveAlerts = async () => {
  try {
    return await db.select()
      .from(schema.alerts)
      .where(eq(schema.alerts.isActive, true));
  } catch (error) {
    console.error('Error getting active alerts:', error);
    throw error;
  }
};

// Order operations
export const createOrder = async (
  userId: number,
  inputMint: string,
  inputSymbol: string,
  outputMint: string,
  outputSymbol: string,
  outputTokenPrice: number,
  inputTokenAmount: number
) => {
  try {
    const dbUser = await ensureUserExists(userId);
    const [order] = await db.insert(schema.orders)
      .values({
        userId: dbUser.id,
        inputMint,
        inputSymbol,
        outputMint,
        outputSymbol,
        outputTokenPrice,
        inputTokenAmount
      })
      .returning();
    return order;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

export const getOrderById = async (id: number) => {
  try {
    return await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id));
  } catch (error) {
    console.error('Error getting order by id:', error);
    throw error;
  }
};

export const getUserOrders = async (userId: number) => {
  try {
    const dbUser = await ensureUserExists(userId);
    return await db.select()
      .from(schema.orders)
      .where(and(
        eq(schema.orders.userId, dbUser.id),
        eq(schema.orders.isActive, true)
      ));
  } catch (error) {
    console.error('Error getting user orders:', error);
    throw error;
  }
};

export const getAllUserOrders = async (userId: number) => {
  try {
    const dbUser = await ensureUserExists(userId);
    return await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.userId, dbUser.id));
  } catch (error) {
    console.error('Error getting all user orders:', error);
    throw error;
  }
};

export const deactivateOrder = async (orderId: number) => {
  try {
    await db.update(schema.orders)
      .set({ isActive: false })
      .where(eq(schema.orders.id, orderId));
  } catch (error) {
    console.error('Error deactivating order:', error);
    throw error;
  }
};

export const getAllActiveOrders = async () => {
  try {
    return await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.isActive, true));
  } catch (error) {
    console.error('Error getting active orders:', error);
    throw error;
  }
};

// Token metadata operations
export const getTokenMetadata = async (identifier: string): Promise<schema.Token | null> => {
  try {
    // If identifier is less than 5 characters, treat it as a symbol
    if (identifier.length < 5) {
      const tokens = await db.select()
        .from(schema.tokens)
        .where(eq(schema.tokens.symbol, identifier.toUpperCase()))
        .limit(1);

      return tokens[0] || null;
    }

    const tokens = await db.select()
      .from(schema.tokens)
      .where(eq(schema.tokens.mintAddress, identifier))
      .limit(1);

    return tokens[0] || null;
  } catch (error) {
    console.error('Error getting token metadata:', error);
    throw error;
  }
};

export const getTokenMetadatas = async (identifiers: string[]): Promise<schema.Token[]> => {
  try {
    const results = await Promise.all(identifiers.map(getTokenMetadata));
    return results.filter((token): token is schema.Token => token !== null);
  } catch (error) {
    console.error('Error getting multiple token metadatas:', error);
    throw error;
  }
};

export { db };
export type { User, NewUser, Keypair, NewKeypair, Alert, NewAlert, Order, NewOrder, Token, NewToken } from './schema'; 