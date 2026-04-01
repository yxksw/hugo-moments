import { getDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Test database connection
export default async function handler(req) {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const sql = getDb();
    
    // Test connection with a simple query
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    
    // Check if likes table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'likes'
      ) as likes_table_exists
    `;

    return createResponse({
      success: true,
      message: 'Database connection successful',
      data: {
        currentTime: result[0].current_time,
        dbVersion: result[0].db_version,
        likesTableExists: tableCheck[0].likes_table_exists,
      },
    });

  } catch (error) {
    console.error('Database test error:', error);
    return createResponse({ 
      error: 'Database connection failed',
      message: error.message 
    }, 500);
  }
}
