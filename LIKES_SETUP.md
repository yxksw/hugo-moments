# Hugo Memos 点赞系统设置指南

## 功能特性

- ✅ 用户对文章点赞/取消点赞（切换模式）
- ✅ 使用 Neon PostgreSQL 数据库存储点赞记录
- ✅ 实时统计每篇文章的点赞数量
- ✅ 点赞状态持久化，刷新页面后保持
- ✅ 批量获取点赞状态，优化性能
- ✅ 乐观并发控制，防止数据不一致
- ✅ 完整的错误处理机制

## 技术架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Hugo 静态网站  │────▶│  Vercel API     │────▶│  Neon PostgreSQL│
│  (Frontend)     │◀────│  (Serverless)   │◀────│  (Database)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 数据库表结构

### likes 表
存储用户点赞记录：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| post_id | VARCHAR(255) | 文章ID |
| user_id | VARCHAR(255) | 用户ID（基于IP+UA生成） |
| is_liked | BOOLEAN | 是否点赞 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### post_stats 表
缓存文章点赞统计：

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | VARCHAR(255) | 文章ID（主键） |
| like_count | INTEGER | 点赞数量 |
| updated_at | TIMESTAMP | 更新时间 |

## 部署步骤

### 1. 创建 Neon PostgreSQL 数据库

1. 访问 [Neon Console](https://console.neon.tech/)
2. 创建新项目
3. 创建数据库（例如：`hugo_memos`）
4. 复制连接字符串（Connection String）

### 2. 配置 Vercel 环境变量

在 Vercel 项目设置中添加环境变量：

```
DATABASE_URL=postgresql://username:password@hostname/database_name?sslmode=require
```

### 3. 初始化数据库

部署后，访问以下 URL 初始化数据库表：

```
POST https://your-domain.com/api/init-db
```

或使用 curl：

```bash
curl -X POST https://your-domain.com/api/init-db
```

### 4. 配置前端 API 地址（可选）

如果 API 和前端不在同一域名，需要在 `config.yaml` 中添加：

```yaml
params:
  likeApiUrl: "https://your-api-domain.com"
```

然后在 `layouts/partials/head.html` 中添加：

```html
<script>
  window.LIKE_API_URL = "{{ .Site.Params.likeApiUrl }}";
</script>
```

## API 接口文档

### 1. 切换点赞状态

```
POST /api/like?postId={postId}
```

**响应：**
```json
{
  "success": true,
  "postId": "abc123",
  "isLiked": true,
  "likeCount": 42
}
```

### 2. 获取点赞状态

```
GET /api/likes?postId={postId}
```

**响应：**
```json
{
  "success": true,
  "postId": "abc123",
  "isLiked": true,
  "likeCount": 42
}
```

### 3. 批量获取点赞状态

```
GET /api/batch-likes?postIds=abc123,def456,ghi789
```

**响应：**
```json
{
  "success": true,
  "results": [
    {"postId": "abc123", "isLiked": true, "likeCount": 42},
    {"postId": "def456", "isLiked": false, "likeCount": 10},
    {"postId": "ghi789", "isLiked": true, "likeCount": 5}
  ]
}
```

## 文件结构

```
hugo-memos/
├── api/                          # Vercel Serverless Functions
│   ├── _utils/
│   │   ├── db.js                # 数据库连接工具
│   │   └── cors.js              # CORS 处理工具
│   ├── package.json             # API 依赖
│   ├── init-db.js               # 数据库初始化
│   ├── like.js                  # 点赞切换 API
│   ├── likes.js                 # 获取点赞状态 API
│   └── batch-likes.js           # 批量获取点赞状态 API
├── static/
│   └── scripts/
│       └── likes.js             # 前端点赞功能
├── layouts/
│   └── partials/
│       ├── row.html             # 文章列表模板（已添加点赞按钮）
│       └── after-content-js.html # 引入点赞脚本
├── vercel.json                  # Vercel 配置
└── LIKES_SETUP.md              # 本文件
```

## 用户识别机制

由于 Hugo 是静态网站，没有用户登录系统，点赞系统使用以下方式识别用户：

1. **IP 地址** + **User-Agent** 组合生成唯一标识
2. **localStorage** 存储设备ID作为辅助识别

**注意：** 这种方式不是绝对安全的，同一网络下的不同设备可能被识别为同一用户。

## 并发控制

系统使用 PostgreSQL 的行级锁（`FOR UPDATE`）来防止并发问题：

```sql
SELECT id, is_liked FROM likes 
WHERE post_id = ? AND user_id = ?
FOR UPDATE
```

这确保了同一用户同时多次点击点赞按钮时，数据不会出错。

## 性能优化

1. **批量查询**：页面加载时一次性获取所有文章的点赞状态
2. **缓存统计**：使用 `post_stats` 表缓存点赞数量，避免实时计算
3. **乐观更新**：前端先更新 UI，再发送请求，提升用户体验

## 故障排查

### 点赞不生效

1. 检查浏览器控制台是否有 JavaScript 错误
2. 检查 Network 标签中 API 请求是否成功
3. 检查 Vercel Functions 日志

### 数据库连接失败

1. 确认 `DATABASE_URL` 环境变量已正确设置
2. 确认 Neon 数据库允许从 Vercel IP 访问
3. 检查连接字符串格式是否正确

### 跨域错误

如果前端和 API 不在同一域名，确保：
1. `cors.js` 中的 `Access-Control-Allow-Origin` 设置正确
2. 或设置为 `*` 允许所有域名

## 安全建议

1. **生产环境**建议添加请求频率限制（Rate Limiting）
2. 考虑添加验证码防止恶意刷赞
3. 定期备份 Neon 数据库
4. 监控异常点赞行为

## 后续扩展

可以考虑添加的功能：
- 用户登录系统（使用 GitHub/Google OAuth）
- 点赞通知（邮件或站内信）
- 点赞排行榜
- 文章推荐算法（基于点赞数据）
