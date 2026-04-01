import { handleCors, createResponse } from './_utils/cors.js';

// Health check endpoint
export default async function handler(req) {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  return createResponse({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    env: {
      databaseUrlSet: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
    }
  });
}
