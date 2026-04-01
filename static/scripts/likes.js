// Like System for Hugo Memos Blog
// Uses Neon PostgreSQL database via Vercel Edge Functions

(function() {
  'use strict';

  // API base URL - change this to your actual API endpoint
  const API_BASE_URL = window.LIKE_API_URL || '';

  // Storage key for liked posts (for UI persistence)
  const STORAGE_KEY = 'hugo_memos_likes';

  // Get stored likes from localStorage
  const getStoredLikes = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  };

  // Store likes to localStorage
  const storeLikes = (likes) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(likes));
    } catch (e) {
      console.warn('Failed to store likes:', e);
    }
  };

  // Generate a unique device ID for anonymous users
  const getDeviceId = () => {
    let deviceId = localStorage.getItem('hugo_memos_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('hugo_memos_device_id', deviceId);
    }
    return deviceId;
  };

  // Fetch like status for a single post
  const fetchLikeStatus = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/likes?postId=${encodeURIComponent(postId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch like status:', error);
      return null;
    }
  };

  // Fetch like status for multiple posts (batch)
  const fetchBatchLikeStatus = async (postIds) => {
    if (!postIds || postIds.length === 0) return {};

    try {
      const idsParam = postIds.join(',');
      const response = await fetch(`${API_BASE_URL}/api/batch-likes?postIds=${encodeURIComponent(idsParam)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.results) {
        const resultMap = {};
        data.results.forEach(result => {
          resultMap[result.postId] = result;
        });
        return resultMap;
      }
      return {};
    } catch (error) {
      console.error('Failed to fetch batch like status:', error);
      return {};
    }
  };

  // Toggle like for a post
  const toggleLike = async (postId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/like?postId=${encodeURIComponent(postId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to toggle like:', error);
      return null;
    }
  };

  // Update UI for a like button
  const updateLikeUI = (btn, isLiked, likeCount) => {
    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('.like-count');

    if (icon) {
      if (isLiked) {
        icon.classList.remove('far');
        icon.classList.add('fas');
        icon.style.color = '#ff0000';
        btn.setAttribute('data-liked', 'true');
      } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
        icon.style.color = '';
        btn.setAttribute('data-liked', 'false');
      }
    }

    if (countSpan) {
      countSpan.textContent = likeCount > 0 ? likeCount : '';
    }

    // Store in localStorage for persistence
    const storedLikes = getStoredLikes();
    storedLikes[btn.getAttribute('data-post-id')] = {
      isLiked,
      likeCount,
      timestamp: Date.now(),
    };
    storeLikes(storedLikes);
  };

  // Initialize like buttons
  const initLikeButtons = async () => {
    const likeBtns = document.querySelectorAll('.like-btn');
    if (likeBtns.length === 0) return;

    // Collect all post IDs
    const postIds = [];
    likeBtns.forEach(btn => {
      const postId = btn.getAttribute('data-post-id');
      if (postId) {
        postIds.push(postId);
      }
    });

    // Fetch batch like status
    const likeStatusMap = await fetchBatchLikeStatus(postIds);

    // Update UI for each button
    likeBtns.forEach(btn => {
      const postId = btn.getAttribute('data-post-id');
      if (!postId) return;

      // Add click handler
      btn.addEventListener('click', handleLikeClick);

      // Update initial state
      const status = likeStatusMap[postId];
      if (status) {
        updateLikeUI(btn, status.isLiked, status.likeCount);
      } else {
        // Fallback to localStorage
        const storedLikes = getStoredLikes();
        const stored = storedLikes[postId];
        if (stored) {
          updateLikeUI(btn, stored.isLiked, stored.likeCount);
        }
      }
    });
  };

  // Handle like button click
  const handleLikeClick = async (event) => {
    const btn = event.currentTarget;
    const postId = btn.getAttribute('data-post-id');

    if (!postId) {
      console.error('No post ID found for like button');
      return;
    }

    // Prevent double-clicking
    if (btn.getAttribute('data-processing') === 'true') {
      return;
    }

    btn.setAttribute('data-processing', 'true');

    // Optimistic UI update
    const currentLiked = btn.getAttribute('data-liked') === 'true';
    const currentCount = parseInt(btn.querySelector('.like-count')?.textContent || '0');
    const newLiked = !currentLiked;
    const newCount = newLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

    updateLikeUI(btn, newLiked, newCount);

    // Send request to server
    const result = await toggleLike(postId);

    if (result && result.success) {
      // Update with server response
      updateLikeUI(btn, result.isLiked, result.likeCount);
    } else {
      // Revert on error
      console.error('Failed to toggle like, reverting UI');
      updateLikeUI(btn, currentLiked, currentCount);
      alert('操作失败，请稍后重试');
    }

    btn.setAttribute('data-processing', 'false');
  };

  // Add post IDs to like buttons
  const addPostIdsToButtons = () => {
    const momentRows = document.querySelectorAll('.moment-row');
    momentRows.forEach((row, index) => {
      const likeBtn = row.querySelector('.like-btn');
      if (likeBtn) {
        // Try to get post ID from various sources
        let postId = row.getAttribute('data-post-id');
        
        // If no data-post-id, try to extract from URL or other elements
        if (!postId) {
          const linkElement = row.querySelector('a[href*="/posts/"]');
          if (linkElement) {
            const href = linkElement.getAttribute('href');
            const match = href.match(/\/posts\/(\d+)/);
            if (match) {
              postId = match[1];
            }
          }
        }

        // If still no postId, use index as fallback
        if (!postId) {
          postId = `post_${index}`;
        }

        likeBtn.setAttribute('data-post-id', postId);
        
        // Add like count display element if not exists
        if (!likeBtn.querySelector('.like-count')) {
          const countSpan = document.createElement('span');
          countSpan.className = 'like-count';
          likeBtn.appendChild(countSpan);
        }
      }
    });
  };

  // Initialize on DOM ready
  const init = () => {
    addPostIdsToButtons();
    initLikeButtons();
  };

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize on dynamic content changes (if using pagination or infinite scroll)
  window.reinitLikes = init;

})();
