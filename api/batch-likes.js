import { getDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Generate a unique user ID from IP and user agent
const generateUserId = (req) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  return btoa(`${ip}:${ua}`).slice(0, 32);
};

// Get like status for multiple posts (batch request)
export default async function handler(req) {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { searchParams } = new URL(req.url);
    const postIdsParam = searchParams.get('postIds');

    if (!postIdsParam) {
      return createResponse({ error: 'postIds is required (comma-separated)' }, 400);
    }

    const postIds = postIdsParam.split(',').filter(id => id.trim());
    
    if (postIds.length === 0) {
      return createResponse({ error: 'At least one postId is required' }, 400);
    }

    // Limit batch size to prevent abuse
    if (postIds.length > 100) {
      return createResponse({ error: 'Maximum 100 postIds allowed per request' }, 400);
    }

    const sql = getDb();
    const userId = generateUserId(req);

    // Get user's like status for all requested posts
    const userLikes = await sql`
      SELECT post_id, is_liked 
      FROM likes 
      WHERE post_id IN (${postIds}) 
      AND user_id = ${userId}
    `;

    // Create a map of postId -> isLiked
    const userLikeMap = {};
    userLikes.forEach(like => {
      userLikeMap[like.post_id] = like.is_liked;
    });

    // Get like counts for all posts
    const likeCounts = await sql`
      SELECT post_id, like_count 
      FROM post_stats 
      WHERE post_id IN (${postIds})
    `;

    // Create a map of postId -> likeCount
    const countMap = {};
    likeCounts.forEach(stat => {
      countMap[stat.post_id] = stat.like_count;
    });

    // Build response for all requested posts
    const results = postIds.map(postId => ({
      postId,
      isLiked: userLikeMap[postId] || false,
      likeCount: countMap[postId] || 0,
    }));

    return createResponse({
      success: true,
      results,
    });

  } catch (error) {
    console.error('Batch likes error:', error);
    return createResponse({ 
      error: 'Internal server error',
      message: error.message 
    }, 500);
  }
}
