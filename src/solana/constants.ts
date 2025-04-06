import {
  Address,
  getBase64Encoder,
  getBase64Decoder,
  getBase58Decoder,
  getTransactionDecoder,
  getCompiledTransactionMessageDecoder,
  getTransactionEncoder,
} from '@solana/kit';

export const SOL_MINT =
  'So11111111111111111111111111111111111111112' as Address;
export const USDC_MINT =
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;

export const base64Encoder = getBase64Encoder();
export const base64Decoder = getBase64Decoder();
export const base58Decoder = getBase58Decoder();
export const transactionDecoder = getTransactionDecoder();
export const transactionEncoder = getTransactionEncoder();
export const compiledTransactionMessageDecoder =
  getCompiledTransactionMessageDecoder();

export const jitoTipAccounts = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export const TOKEN_PROGRAM =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
export const TOKEN_PROGRAM_2022 =
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
export const ASSOCIATED_TOKEN_PROGRAM =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address;
export const SYSTEM_PROGRAM = '11111111111111111111111111111111' as Address;
export const JUPITER_PROGRAM =
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' as Address;
export const DELEGATE_VAULT_PROGRAM =
  'AHNJKkm4Gd3FpUrdhYsuvf7tPErUpR8dgmx6xNPSHNuc' as Address;