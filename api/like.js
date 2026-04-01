import { getDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Generate a unique user ID from IP and user agent (for anonymous users)
const generateUserId = (req) => {
  // In production, you might want to use a more sophisticated method
  // or require users to be logged in
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  // Simple hash - in production use a proper hashing function
  return btoa(`${ip}:${ua}`).slice(0, 32);
};

// Toggle like status for a post
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

    // Check if user has already liked this post
    const existingLike = await sql`
      SELECT id, is_liked FROM likes 
      WHERE post_id = ${postId} AND user_id = ${userId}
      FOR UPDATE
    `;

    let isLiked;
    let likeCount;

    if (existingLike.length > 0) {
      // Toggle like status
      isLiked = !existingLike[0].is_liked;
      
      await sql`
        UPDATE likes 
        SET is_liked = ${isLiked}, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ${existingLike[0].id}
      `;
    } else {
      // Create new like
      isLiked = true;
      
      await sql`
        INSERT INTO likes (post_id, user_id, is_liked)
        VALUES (${postId}, ${userId}, ${isLiked})
      `;
    }

    // Update like count in post_stats
    const countResult = await sql`
      SELECT COUNT(*) as count 
      FROM likes 
      WHERE post_id = ${postId} AND is_liked = TRUE
    `;
    
    likeCount = parseInt(countResult[0].count);

    // Upsert post_stats
    await sql`
      INSERT INTO post_stats (post_id, like_count, updated_at)
      VALUES (${postId}, ${likeCount}, CURRENT_TIMESTAMP)
      ON CONFLICT (post_id) 
      DO UPDATE SET 
        like_count = ${likeCount},
        updated_at = CURRENT_TIMESTAMP
    `;

    return createResponse({
      success: true,
      postId,
      isLiked,
      likeCount,
    });

  } catch (error) {
    console.error('Like toggle error:', error);
    return createResponse({ 
      error: 'Internal server error',
      message: error.message 
    }, 500);
  }
}
