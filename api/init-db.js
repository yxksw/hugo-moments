import { testConnection, initDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Initialize database collections
export default async function handler(req) {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Allow POST and GET requests
    if (req.method !== 'POST' && req.method !== 'GET') {
      return createResponse({ error: 'Method not allowed' }, 405);
    }

    // Check if MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      return createResponse({ 
        error: 'MONGODB_URI environment variable is not set',
        hint: 'Please set the MONGODB_URI environment variable in Vercel project settings'
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
        hint: 'Please check your MONGODB_URI and ensure the database is accessible from Vercel'
      }, 500);
    }

    // Initialize database
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
      hint: 'Please check your MONGODB_URI and ensure the database is accessible'
    }, 500);
  }
}
