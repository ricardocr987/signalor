import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { JupiterService } from '../services/jup';

const generateSchema = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('Starting database schema generation...');

  // Create a new connection for migrations
  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Drop all tables if they exist
    console.log('Dropping existing tables...');
    await db.execute(sql`
      DROP TABLE IF EXISTS tokens CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS keypairs CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
    `);

    // Create tables
    console.log('Creating tables...');
    await db.execute(sql`
      CREATE TABLE tokens (
        mint_address TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        decimals INTEGER NOT NULL,
        logo_url TEXT,
        daily_volume REAL,
        extensions JSONB,
        freeze_authority TEXT,
        mint_authority TEXT,
        minted_at TIMESTAMP,
        permanent_delegate TEXT,
        tags JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time BIGINT
      );

      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        telegram_id INTEGER UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE keypairs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        condition TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        input_mint TEXT NOT NULL,
        input_symbol TEXT NOT NULL,
        output_mint TEXT NOT NULL,
        price REAL NOT NULL,
        amount REAL NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    console.log('Creating indexes...');
    await db.execute(sql`
      CREATE INDEX idx_tokens_symbol ON tokens(symbol);
      CREATE INDEX idx_tokens_name ON tokens(name);
      CREATE INDEX idx_tokens_daily_volume ON tokens(daily_volume DESC);
      CREATE INDEX idx_tokens_tags ON tokens USING GIN (tags);
      CREATE INDEX idx_tokens_extensions ON tokens USING GIN (extensions);
    `);

    console.log('Schema generation completed successfully');

    // Fetch and store tokens
    console.log('Fetching and storing tokens...');
    await JupiterService.fetchAndStoreTokens();

  } catch (error) {
    console.error('Schema generation failed:', error);
    process.exit(1);
  }

  await migrationClient.end();
  process.exit(0);
};

generateSchema(); 