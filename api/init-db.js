import { initDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Initialize database tables
export default async function handler(req) {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Only allow POST requests for initialization
    if (req.method !== 'POST') {
      return createResponse({ error: 'Method not allowed' }, 405);
    }

    // Initialize database
    await initDb();

    return createResponse({
      success: true,
      message: 'Database initialized successfully',
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    return createResponse({ 
      error: 'Failed to initialize database',
      message: error.message 
    }, 500);
  }
}
