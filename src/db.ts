import { Database } from "bun:sqlite";

// Types
interface User {
  id: number;
  telegram_id: number;
  created_at: string;
}

interface Keypair {
  id: number;
  user_id: number;
  public_key: string;
  private_key: string;
  created_at: string;
}

export interface Alert {
  id: number;
  user_id: number;
  symbol: string;
  price: number;
  condition: string;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: number;
  user_id: number;
  input_mint: string;
  input_symbol: string;
  output_mint: string;
  price: number;
  amount: number;
  is_active: boolean;
  created_at: string;
}

// Initialize database
const db = new Database("signals.db");

// Initialize database schema
export const initDb = () => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      telegram_id INTEGER UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create keypairs table
  db.run(`
    CREATE TABLE IF NOT EXISTS keypairs (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create alerts table
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      condition TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create orders table
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      input_mint TEXT NOT NULL,
      input_symbol TEXT NOT NULL,
      output_mint TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
};

// User operations
export const getUserByTelegramId = (telegramId: number): User | undefined => {
  return db.query("SELECT * FROM users WHERE telegram_id = ?").get(telegramId) as User | undefined;
};

export const createUser = (telegramId: number): User => {
  return db.query("INSERT INTO users (telegram_id) VALUES (?) RETURNING *").get(telegramId) as User;
};

export const getAllUsers = (): { id: number }[] => {
  return db.query("SELECT id FROM users").all() as { id: number }[];
};

// Keypair operations
export const createKeypair = (userId: number, publicKey: string, privateKey: string): Keypair => {
  return db.query(`
    INSERT INTO keypairs (user_id, public_key, private_key) 
    VALUES (?, ?, ?) 
    RETURNING *
  `).get(userId, publicKey, privateKey) as Keypair;
};

export const getKeypairByUserId = (userId: number): Keypair | undefined => {
  return db.query("SELECT * FROM keypairs WHERE user_id = ?").get(userId) as Keypair | undefined;
};

// Alert operations
export const createAlert = (userId: number, symbol: string, price: number, condition: string): Alert => {
  return db.query(`
    INSERT INTO alerts (user_id, symbol, price, condition) 
    VALUES (?, ?, ?, ?) 
    RETURNING *
  `).get(userId, symbol, price, condition) as Alert;
};

export const getUserAlerts = (userId: number): Alert[] => {
  return db.query("SELECT * FROM alerts WHERE user_id = ? AND is_active = TRUE").all(userId) as Alert[];
};

export const deactivateAlert = (alertId: number): void => {
  db.query("UPDATE alerts SET is_active = FALSE WHERE id = ?").run(alertId);
};

export const getAllActiveAlerts = (): Alert[] => {
  return db.query("SELECT * FROM alerts WHERE is_active = TRUE").all() as Alert[];
};

// Order operations
export const createOrder = (userId: number, inputMint: string, inputSymbol: string, outputMint: string, price: number, amount: number): Order => {
  return db.query(`
    INSERT INTO orders (user_id, input_mint, input_symbol, output_mint, price, amount) 
    VALUES (?, ?, ?, ?, ?, ?) 
    RETURNING *
  `).get(userId, inputMint, inputSymbol, outputMint, price, amount) as Order;
};

export const getUserOrders = (userId: number): Order[] => {
  return db.query("SELECT * FROM orders WHERE user_id = ? AND is_active = TRUE").all(userId) as Order[];
};

export const getAllUserOrders = (userId: number): Order[] => {
  return db.query("SELECT * FROM orders WHERE user_id = ?").all(userId) as Order[];
};

export const deactivateOrder = (orderId: number): void => {
  db.query("UPDATE orders SET is_active = FALSE WHERE id = ?").run(orderId);
};

export const getAllActiveOrders = (): Order[] => {
  return db.query("SELECT * FROM orders WHERE is_active = TRUE").all() as Order[];
};

// Initialize database on import
initDb();

export default db;
