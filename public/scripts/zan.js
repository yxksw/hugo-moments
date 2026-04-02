(function(){
  // === 配置项 BEGIN ===
  var BLOG_LIKE_CONFIG = {
    enable: true,
    Backend: "Cloudflare",
    CloudflareBackend: "https://likes.314926.xyz/like",
    PHPBackend: "/like",
    AppID: "",
    AppKEY: "",
    GoogleAnalytics: false,
    GAEventCategory: "Engagement",
    GAEventAction: "Like"
  };
  // === 配置项 END ===
  if (!BLOG_LIKE_CONFIG.enable) return;

  var alertBox = null;
  var alertTimer = null;
  var requestingMap = {};

  function showAlert(msg) {
    if (!alertBox) {
      alertBox = document.createElement("div");
      alertBox.style.position = "fixed";
      alertBox.style.top = "20%";
      alertBox.style.left = "50%";
      alertBox.style.transform = "translate(-50%, -50%)";
      alertBox.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
      alertBox.style.color = "white";
      alertBox.style.padding = "15px 30px";
      alertBox.style.borderRadius = "8px";
      alertBox.style.zIndex = "1000";
      alertBox.style.fontSize = "16px";
      alertBox.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.2)";
      document.body.appendChild(alertBox);
    }
    alertBox.innerText = msg;
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = setTimeout(function () {
      if (alertBox && alertBox.parentNode) {
        alertBox.parentNode.removeChild(alertBox);
      }
      alertBox = null;
      alertTimer = null;
    }, 1800);
  }

  function heartAnimation(index) {
    var heart = document.querySelector('.zan[data-index="' + index + '"] .heart');
    if (heart) {
      heart.classList.remove('heartAnimation');
      void heart.offsetWidth;
      heart.classList.add('heartAnimation');
      setTimeout(function(){
        heart.classList.remove('heartAnimation');
      }, 800);
    }
  }

  function getCookie(name) {
    var cookieArr = document.cookie.split(";");
    for (var i = 0; i < cookieArr.length; i++) {
      var cookie = cookieArr[i].trim();
      if (cookie.startsWith(name + "=")) {
        return cookie.substring(name.length + 1);
      }
    }
    return null;
  }

  function setCookie(name, value, days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    var expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
  }

  function deleteCookie(name) {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
  }

  function getVisitorLiked(url) {
    var liked = getCookie("likes_" + url);
    return liked === "1";
  }

  function setVisitorLiked(url, liked) {
    if (liked) {
      setCookie("likes_" + url, "1", 30);
    } else {
      deleteCookie("likes_" + url);
    }
  }

  function setHeartLiked(index, liked) {
    var heart = document.querySelector('.zan[data-index="' + index + '"] .heart');
    if (heart) {
      if (liked) {
        heart.classList.add('liked');
      } else {
        heart.classList.remove('liked');
        heart.classList.remove('heartAnimation');
      }
    }
  }

  function updateZanText(index, num) {
    var el = document.querySelector('.zan_text[data-index="' + index + '"]');
    if (el) {
      el.innerHTML = num;
    }
  }

  function sendGAEvent(url) {
    if (BLOG_LIKE_CONFIG.GoogleAnalytics && typeof window.gtag === 'function') {
      gtag('event', BLOG_LIKE_CONFIG.GAEventAction || 'Like', {
        'event_category': BLOG_LIKE_CONFIG.GAEventCategory || 'Engagement',
        'event_label': url
      });
    }
  }

  // =============== Cloudflare 存储 ===============
  function mainCloudflare() {
    function getCloudflareApiUrl() {
      return BLOG_LIKE_CONFIG.CloudflareBackend;
    }

    function cloudflareLike(url, index, delta, done) {
      var apiUrl = getCloudflareApiUrl();
      if (!apiUrl) {
        showAlert("Cloudflare 后端未配置");
        console.error('Cloudflare 后端未配置');
        if (done) done();
        return;
      }

      var bodyData = {
        Url: url,
        Add: delta
      };

      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        if (done) done();
      }

      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      })
      .then(function(resp){
        if (resp.status === 429) {
          showAlert("您已达到速率限制");
          throw new Error("429");
        }
        return resp.json();
      })
      .then(function(d){
        if (typeof d['likes'] !== "undefined") {
          updateZanText(index, d['likes']);
          if (delta > 0) {
            setVisitorLiked(url, true);
            setHeartLiked(index, true);
            heartAnimation(index);
          } else if (delta < 0) {
            setVisitorLiked(url, false);
            setHeartLiked(index, false);
          }
        } else {
          showAlert("Failed to get likes");
        }
        finish();
      })
      .catch(function(e){
        if(e && e.message === "429") return;
        showAlert("后端请求失败, 请检查Cloudflare配置");
        console.error("Cloudflare 请求失败：", e);
        finish();
      });
    }

    window.goodplus = function(url, index) {
      var key = url + '_' + index;
      if (requestingMap[key]) return;

      var targetLiked = !getVisitorLiked(url);
      var delta = targetLiked ? 1 : -1;
      if (targetLiked) sendGAEvent(url);

      requestingMap[key] = true;
      cloudflareLike(url, index, delta, function(){
        requestingMap[key] = false;
      });
    };

    // 初始化所有点赞组件
    document.addEventListener('DOMContentLoaded', function() {
      var zanElements = document.querySelectorAll('.zan');
      zanElements.forEach(function(el) {
        var index = el.getAttribute('data-index');
        var heart = el.querySelector('.heart');
        if (heart) {
          // 从 onclick 属性中提取 URL
          var onclickAttr = heart.getAttribute('onclick');
          var urlMatch = onclickAttr.match(/goodplus\('([^']+)'/);
          if (urlMatch) {
            var url = urlMatch[1];
            setHeartLiked(index, getVisitorLiked(url));
            // 获取初始点赞数
            cloudflareLike(url, index, 0, function(){});
          }
        }
      });
    });
  }

  // =============== 主入口 ===============
  if (BLOG_LIKE_CONFIG.Backend === "Cloudflare") {
    mainCloudflare();
  }
})();
