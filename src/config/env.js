import dotenv from 'dotenv';

const result = dotenv.config();

if (result.error && result.error.code !== "ENOENT") {
  throw new Error(`Could not load environment variables: ${result.error.message}`);
}

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const PORT = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

export const AI_API_KEY = requiredEnv('AI_API_KEY');
export const SUPABASE_URL = requiredEnv('SUPABASE_URL');
export const SUPABASE_SECRET_KEY = requiredEnv('SUPABASE_SECRET_KEY');
export const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173"

