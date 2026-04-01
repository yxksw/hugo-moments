import { testConnection, initDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Initialize database tables
export default async function handler(req) {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Allow POST and GET requests for initialization
    if (req.method !== 'POST' && req.method !== 'GET') {
      return createResponse({ error: 'Method not allowed' }, 405);
    }

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      return createResponse({ 
        error: 'DATABASE_URL environment variable is not set',
        hint: 'Please set the DATABASE_URL environment variable in Vercel project settings'
      }, 500);
    }

    // Test connection first
    let connectionTest;
    try {
      connectionTest = await testConnection();
    } catch (connError) {
      return createResponse({ 
        error: 'Database connection failed',
        message: connError.message,
        hint: 'Please check your DATABASE_URL and ensure the database is accessible from Vercel'
      }, 500);
    }

    // Initialize database tables
    await initDb();

    return createResponse({
      success: true,
      message: 'Database initialized successfully',
      connectionTest: connectionTest,
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return createResponse({ 
      error: 'Failed to initialize database',
      message: error.message,
      hint: 'Please check your DATABASE_URL and ensure the database is accessible'
    }, 500);
  }
}
