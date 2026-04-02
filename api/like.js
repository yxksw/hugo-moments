import { getDb } from './_utils/db.js';
import { handleCors, createResponse } from './_utils/cors.js';

// Generate a unique user ID from IP and user agent
const generateUserId = (req) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  return Buffer.from(`${ip}:${ua}`).toString('base64').slice(0, 32);
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

    const db = await getDb();
    const userId = generateUserId(req);
    const likesCollection = db.collection('likes');
    const statsCollection = db.collection('post_stats');

    // Find existing like
    const existingLike = await likesCollection.findOne({ post_id: postId, user_id: userId });

    let isLiked;

    if (existingLike) {
      // Toggle like status
      isLiked = !existingLike.is_liked;
      await likesCollection.updateOne(
        { _id: existingLike._id },
        { $set: { is_liked: isLiked, updated_at: new Date() } }
      );
    } else {
      // Create new like
      isLiked = true;
      await likesCollection.insertOne({
        post_id: postId,
        user_id: userId,
        is_liked: isLiked,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Update like count
    const likeCount = await likesCollection.countDocuments({ post_id: postId, is_liked: true });

    // Update post_stats
    await statsCollection.updateOne(
      { post_id: postId },
      { $set: { like_count: likeCount, updated_at: new Date() } },
      { upsert: true }
    );

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
