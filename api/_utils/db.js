import { neon, neonConfig } from '@neondatabase/serverless';

// Configure neon for serverless environment
neonConfig.fetchConnectionCache = true;

// Initialize Neon database connection
export const getDb = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
};

// Test database connection
export const testConnection = async () => {
  const sql = getDb();
  const result = await sql`SELECT NOW() as now`;
  return result[0].now;
};

// Initialize database tables
export const initDb = async () => {
  const sql = getDb();

  // Create likes table
  await sql`
    CREATE TABLE IF NOT EXISTS likes (
      id SERIAL PRIMARY KEY,
      post_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      is_liked BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )
  `;

  // Create index for faster queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)
  `;

  // Create post_stats table for caching like counts
  await sql`
    CREATE TABLE IF NOT EXISTS post_stats (
      post_id VARCHAR(255) PRIMARY KEY,
      like_count INTEGER DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

  return sql;
};
