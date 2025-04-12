-- Drop existing tokens table
DROP TABLE IF EXISTS tokens;

-- Create new tokens table with mintAddress as primary key
CREATE TABLE tokens (
  mint_address TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  price_1d REAL DEFAULT 0,
  price_7d REAL DEFAULT 0,
  decimal INTEGER NOT NULL,
  logo_url TEXT,
  category TEXT,
  subcategory TEXT,
  verified BOOLEAN DEFAULT FALSE,
  current_supply TEXT,
  market_cap REAL DEFAULT 0,
  token_amount_volume_24h REAL DEFAULT 0,
  usd_value_volume_24h REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on symbol for faster lookups
CREATE INDEX idx_tokens_symbol ON tokens(symbol); 