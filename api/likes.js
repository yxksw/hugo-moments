import { getDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Generate a unique user ID from IP and user agent
const generateUserId = (req) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  return Buffer.from(`${ip}:${ua}`).toString('base64').slice(0, 32);
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

    const db = await getDb();
    const userId = generateUserId(req);
    const likesCollection = db.collection('likes');
    const statsCollection = db.collection('post_stats');

    // Get user's like status
    const userLike = await likesCollection.findOne({ post_id: postId, user_id: userId });
    const isLiked = userLike ? userLike.is_liked : false;

    // Get like count from stats or calculate
    let likeCount = 0;
    const stats = await statsCollection.findOne({ post_id: postId });
    
    if (stats) {
      likeCount = stats.like_count;
    } else {
      likeCount = await likesCollection.countDocuments({ post_id: postId, is_liked: true });
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
