import { getDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Generate a unique user ID from IP and user agent
const generateUserId = (req) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  return btoa(`${ip}:${ua}`).slice(0, 32);
};

// Get like status and count for a post
export default async function handler(req) {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return createResponse({ error: 'postId is required' }, 400);
    }

    const sql = getDb();
    const userId = generateUserId(req);

    // Get user's like status for this post
    const userLike = await sql`
      SELECT is_liked FROM likes 
      WHERE post_id = ${postId} AND user_id = ${userId}
    `;

    const isLiked = userLike.length > 0 ? userLike[0].is_liked : false;

    // Get total like count from cache or calculate
    let likeCount = 0;
    const statsResult = await sql`
      SELECT like_count FROM post_stats 
      WHERE post_id = ${postId}
    `;

    if (statsResult.length > 0) {
      likeCount = statsResult[0].like_count;
    } else {
      // Calculate if not cached
      const countResult = await sql`
        SELECT COUNT(*) as count 
        FROM likes 
        WHERE post_id = ${postId} AND is_liked = TRUE
      `;
      likeCount = parseInt(countResult[0].count);
    }

    return createResponse({
      success: true,
      postId,
      isLiked,
      likeCount,
    });

  } catch (error) {
    console.error('Get likes error:', error);
    return createResponse({ 
      error: 'Internal server error',
      message: error.message 
    }, 500);
  }
}
