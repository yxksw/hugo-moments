import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'hugo_memos';

let cachedClient = null;
let cachedDb = null;

// Connect to MongoDB
export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Get database instance
export async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

// Test database connection
export async function testConnection() {
  const { db } = await connectToDatabase();
  const result = await db.admin().ping();
  return result;
}

// Initialize database collections and indexes
export async function initDb() {
  const { db } = await connectToDatabase();

  // Create likes collection
  const likesCollection = db.collection('likes');

  // Create indexes
  await likesCollection.createIndex({ post_id: 1, user_id: 1 }, { unique: true });
  await likesCollection.createIndex({ post_id: 1 });
  await likesCollection.createIndex({ user_id: 1 });

  // Create post_stats collection
  const statsCollection = db.collection('post_stats');
  await statsCollection.createIndex({ post_id: 1 }, { unique: true });

  return db;
}
