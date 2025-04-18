-- Drop existing tokens table
DROP TABLE IF EXISTS tokens;

-- Create new tokens table with mintAddress as primary key
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

-- Create index on symbol for faster lookups
CREATE INDEX idx_tokens_symbol ON tokens(symbol); 