# ZUTOMAYO 無料交換 — API 文档

## 基础信息

- **Base URL**: `http://localhost:8000/api`
- **认证方式**: Bearer Token (JWT)，Header 中传 `Authorization: Bearer <access_token>`
- **Access Token 有效期**: 30 分钟
- **Refresh Token 有效期**: 7 天
- **Content-Type**: `application/json`（上传图片使用 `multipart/form-data`）

---

## 认证

### POST /api/auth/register — 注册

需提供有效邀请码。

```
Body: {
  "email": "user@example.com",     // string, 必填, 合法电邮格式
  "password": "password123",       // string, 必填
  "nickname": "我的暱稱",           // string, 必填
  "invite_code": "ZTMY-xxxxxx"    // string, 必填
}
Response 200: {
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { "id": 1, "email": "...", "nickname": "...", ... }
}
```

### POST /api/auth/login — 登入

```
Body: {
  "email": "user@example.com",     // string, 必填
  "password": "password123"        // string, 必填
}
Response 200: {
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { "id": 1, "email": "...", "nickname": "...", ... }
}
```

### POST /api/auth/refresh — 刷新 Token

```
Body: {
  "refresh_token": "eyJ..."        // string, 必填
}
Response 200: {
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

### GET /api/auth/me — 取得当前用户信息

需要登入。

```
Response 200: {
  "id": 1,
  "email": "user@example.com",
  "nickname": "我的暱稱",
  "avatar": null,
  "is_admin": false,
  "is_banned": false,
  "created_at": "2026-06-06T18:00:00+00:00"
}
```

### PUT /api/auth/me — 更新个人资料

需要登入。

```
Body: {
  "nickname": "新暱稱",             // string, 可选
  "avatar": null                   // string|null, 可选
}
Response 200: UserOut (同上)
```

---

## 物品

### GET /api/items/ — 物品列表

公开。

| 参数 | 类型 | 预设值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 (≥1) |
| page_size | int | 20 | 每页数量 (≤100) |
| category | string | - | 分类 key |
| status | string | available | 状态: available / reserved / exchanged / all |
| exchange_mode | string | - | 交换方式: reach_out / swap |
| search | string | - | 标题/描述关键字搜寻 |
| sort_by | string | newest | 排序: newest / oldest |
| owner_id | int | - | 筛选特定拥有者 |

```
Response 200: {
  "items": [{ ... }],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### GET /api/items/{id} — 物品详情

公开。

```
Response 200: {
  "id": 1,
  "title": "ZTMY 巡演限定貼紙",
  "description": "全新未開封",
  "images": ["/uploads/items/abc.jpg", "/uploads/items/def.jpg"],
  "category": "goods",
  "status": "available",
  "exchange_mode": "swap",
  "owner_id": 2,
  "owner_nickname": "賣家暱稱",
  "owner_avatar": null,
  "wanted_items": "任何 ZTMY CD",
  "stock": 1,
  "created_at": "2026-06-06T18:00:00+00:00",
  "updated_at": "2026-06-06T18:00:00+00:00"
}
```

### POST /api/items/ — 创建物品

需要登入。

```
Body: {
  "title": "物品標題",              // string, 必填, 1-200 字
  "description": "描述",            // string, 可选
  "images": ["/uploads/items/..."], // string[], 可选, 预设 []
  "category": "goods",             // string, 必填, 需为有效分类 key
  "wanted_items": "想要換什麼",      // string, 可选
  "stock": 1,                      // int|null, 可选, null=无限库存
  "exchange_mode": "swap"          // string, 可选, reach_out|swap, 预设 swap
}
Response 200: ItemOut (同上)
```

### PUT /api/items/{id} — 更新物品

需要登入，且必须为物品拥有者。

```
Body: (所有欄位皆可選) {
  "title": "新標題",
  "description": "新描述",
  "images": [...],
  "category": "cd",
  "wanted_items": "...",
  "stock": 3,
  "exchange_mode": "reach_out",
  "status": "reserved"
}
Response 200: ItemOut
```

### DELETE /api/items/{id} — 删除物品

需要登入。拥有者可直接删除，管理员需提供理由。软删除（status → deleted）。

| 参数 | 类型 | 说明 |
|------|------|------|
| reason | string | 可选，管理员删除他人物品时必填 |

```
Response 200: { "detail": "已刪除" }
```

---

## 交换

### GET /api/exchanges/check/{item_id} — 检查交换状态

需要登入。检查当前用户对指定物品是否有进行中的交换。

```
Response 200: { "status": null | "pending" | "accepted" | "completed" }
```

### POST /api/exchanges/ — 发起交换请求

需要登入。目标物品为「伸手」模式时 from_item_id 可选；「互换」模式时必填，且必须为当前用户拥有的物品。

```
Body: {
  "to_item_id": 1,                // int, 必填, 目标物品 ID
  "message": "我想用XX換...",      // string, 可选
  "from_item_id": null             // int, 可选（伸手可为空，互换必填）
}
Response 200: ExchangeOut
```

### GET /api/exchanges/ — 我的交换列表

需要登入。

| 参数 | 类型 | 预设值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |
| role | string | - | sent / received |
| status | string | - | pending / accepted / completed / rejected / cancelled |

```
Response 200: {
  "items": [{
    "id": 1,
    "from_user_id": 2,
    "from_user_nickname": "發起者",
    "to_user_id": 3,
    "to_user_nickname": "接收者",
    "from_item_id": null,
    "from_item_title": null,
    "from_item_images": [],
    "to_item_id": 1,
    "to_item_title": "目標物品",
    "to_item_images": [],
    "to_item_exchange_mode": "swap",
    "status": "pending",
    "message": "交換訊息",
    "created_at": "2026-...",
    "updated_at": "2026-..."
  }],
  "total": 10, "page": 1, "page_size": 20, "total_pages": 1
}
```

### GET /api/exchanges/{id} — 交换详情

需要登入，且必须是交换参与者。

```
Response 200: ExchangeOut (同上單一物件)
```

### PUT /api/exchanges/{id}/accept — 接受交换

需要登入，仅 `to_user` 可操作，状态必须为 `pending`。若 to_item stock==1 则自动设为 reserved。

```
Response 200: ExchangeOut
```

### PUT /api/exchanges/{id}/reject — 拒绝交换

需要登入，仅 `to_user` 可操作，状态必须为 `pending`。

```
Response 200: ExchangeOut
```

### PUT /api/exchanges/{id}/cancel — 取消交换

需要登入，仅 `from_user` 可操作，状态必须为 `pending`。

```
Response 200: ExchangeOut
```

### PUT /api/exchanges/{id}/complete — 完成交换

需要登入，双方皆可操作，状态必须为 `accepted`。完成后 to_item 库存减 1（如为 swap 则 from_item 也减 1），库存耗尽则标记为 exchanged。

```
Response 200: ExchangeOut
```

**交换状态机：**

```
pending ──→ accepted ──→ completed
  │            │
  ├──→ rejected│
  └──→ cancelled
```

---

## 分类

### GET /api/categories/ — 公开分类列表

公开，仅返回启用的分类。

```
Response 200: [{
  "key": "cd",
  "label": "CD",
  "sort_order": 1
}, ...]
```

---

## 消息

### GET /api/messages/exchanges/{id} — 获取交换消息

需要登入，且必须是交换参与者。

```
Response 200: [{
  "id": 1,
  "sender_id": 2,
  "sender_nickname": "發送者",
  "receiver_id": 3,
  "content": "訊息內容",
  "is_read": false,
  "created_at": "2026-..."
}, ...]
```

### POST /api/messages/exchanges/{id} — 发送消息

需要登入，且必须是交换参与者。

```
Body: {
  "content": "訊息內容"             // string, 必填
}
Response 200: MessageOut (同上單一物件)
```

### GET /api/messages/unread-count — 未读消息数

需要登入。

```
Response 200: { "count": 3 }
```

---

## 收藏

### GET /api/favorites/ — 收藏列表

需要登入。

| 参数 | 类型 | 预设值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |

```
Response 200: {
  "items": [ItemOut, ...],
  "total": 5, "page": 1, "page_size": 20, "total_pages": 1
}
```

### POST /api/favorites/ — 添加收藏

需要登入。

```
Body: {
  "item_id": 1                    // int, 必填
}
Response 200: { "detail": "已收藏" }
```

### DELETE /api/favorites/{item_id} — 取消收藏

需要登入。

```
Response 200: { "detail": "已取消收藏" }
```

### GET /api/favorites/check/{item_id} — 检查收藏状态

需要登入。

```
Response 200: { "is_favorited": true }
```

---

## 评价

### POST /api/reviews/ — 提交评价

需要登入。交换必须是 `completed` 状态，每人每交换只能评价一次。

```
Body: {
  "exchange_request_id": 1,       // int, 必填
  "rating": 5,                    // int, 必填, 1-5
  "comment": "很棒的交換體驗"      // string, 可选
}
Response 200: {
  "id": 1,
  "exchange_request_id": 1,
  "reviewer_id": 2,
  "reviewed_user_id": 3,
  "rating": 5,
  "comment": "很棒的交換體驗",
  "created_at": "2026-..."
}
```

### GET /api/reviews/exchanges/{id} — 获取交换的评价

需要登入，且必须是交换参与者。

```
Response 200: [{
  "id": 1,
  "reviewer_nickname": "評價者",
  "rating": 5,
  "comment": "...",
  "created_at": "..."
}, ...]
```

---

## 通知

### GET /api/notifications/ — 通知列表

需要登入。

| 参数 | 类型 | 预设值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |

```
Response 200: {
  "items": [{
    "id": 1,
    "type": "exchange_request",
    "content": "有用戶想與你交換",
    "related_id": 1,
    "is_read": false,
    "created_at": "2026-..."
  }],
  "total": 10, "page": 1, "page_size": 20, "total_pages": 1
}
```

通知类型：`exchange_request` / `exchange_accepted` / `exchange_rejected` / `exchange_completed` / `new_message` / `new_review` / `item_deleted`

### GET /api/notifications/{id} — 通知详情

需要登入（仅限自己的通知）。

### GET /api/notifications/unread-count — 未读通知数

需要登入。

```
Response 200: { "count": 5 }
```

### PUT /api/notifications/{id}/read — 标记为已读

需要登入（仅限自己的通知）。

```
Response 200: { "detail": "ok" }
```

### PUT /api/notifications/read-all — 全部已读

需要登入。

```
Response 200: { "detail": "ok" }
```

---

## 上传

### POST /api/upload/image — 上传物品图片

需要登入。图片会自动裁切为 1:1 正方形、缩放至最长边 2048px、JPEG 质量 85 压缩。

```
Content-Type: multipart/form-data
Body: file=<binary>                // 支持 JPG/PNG/WebP/GIF，最大 5MB

Response 200: { "url": "/uploads/items/uuid.jpg" }
```

### POST /api/upload/avatar — 上传头像

需要登入。上传后自动更新用户头像。

```
Content-Type: multipart/form-data
Body: file=<binary>                // 支持 JPG/PNG/WebP/GIF，最大 5MB

Response 200: { "url": "/uploads/items/uuid.jpg", "avatar": "/uploads/items/uuid.jpg" }
```

---

## 用户（公开）

### GET /api/users/{id} — 用户公开资料

公开。

```
Response 200: {
  "id": 1,
  "nickname": "用戶暱稱",
  "avatar": null,
  "created_at": "2026-...",
  "item_count": 5,
  "avg_rating": 4.5           // float|null
}
```

### GET /api/users/{id}/items — 用户的物品

公开。

| 参数 | 类型 | 预设值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |

```
Response 200: { "items": [ItemOut, ...], "total": 5, "page": 1, "page_size": 20, "total_pages": 1 }
```

### GET /api/users/{id}/reviews — 用户收到的评价

公开。

```
Response 200: {
  "items": [{
    "id": 1,
    "reviewer_nickname": "評價者",
    "rating": 5,
    "comment": "...",
    "created_at": "..."
  }],
  "total": 3, "page": 1, "page_size": 20, "total_pages": 1
}
```

---

## 管理员

所有管理员端点需要管理员权限。

### 邀请码

#### POST /api/admin/invite-codes — 生成邀请码

| 参数 | 类型 | 预设值 | 说明 |
|------|------|--------|------|
| count | int | 5 | 数量 (≤50) |
| prefix | string | ZTMY | 前缀 |

```
Response 200: { "codes": ["ZTMY-xxxxxxxx", ...] }
```

#### GET /api/admin/invite-codes — 邀请码列表

```
Response 200: {
  "items": [{
    "id": 1, "code": "ZTMY-xxxxxxxx",
    "created_by": 1, "used_by": null, "is_used": false,
    "created_at": "..."
  }],
  "total": 20, "page": 1, "page_size": 20
}
```

### 用户管理

#### GET /api/admin/users — 用户列表

```
Response 200: { "items": [UserOut, ...], "total": 100, "page": 1, "page_size": 20 }
```

#### PUT /api/admin/users/{id}/ban — 封禁/解封用户

切换 `is_banned` 状态。

```
Response 200: { "detail": "已更新", "is_banned": true|false }
```

### 分类管理

#### GET /api/admin/categories — 分类列表（含停用）

```
Response 200: [{
  "id": 1, "key": "cd", "label": "CD",
  "sort_order": 1, "is_active": true
}, ...]
```

#### POST /api/admin/categories — 新增分类

```
Body: {
  "key": "goods",                  // string, 必填, 英文标识
  "label": "周邊",                 // string, 必填, 显示名称
  "sort_order": 2                  // int, 可选, 排序
}
Response 200: { "id": 5, "key": "goods", "label": "周邊" }
```

#### PUT /api/admin/categories/{id} — 更新分类

```
Body: {
  "label": "新名稱",                // string, 可选
  "sort_order": 3,                 // int, 可选
  "is_active": true                // bool, 可选, 启用/停用
}
Response 200: { "id": 1, "key": "cd", "label": "CD", "is_active": true }
```

#### DELETE /api/admin/categories/{id} — 删除分类

```
Response 200: { "detail": "已刪除" }
```

### 统计

#### GET /api/admin/stats — 站台统计

```
Response 200: {
  "total_users": 100,
  "total_items": 250,
  "total_exchanges": 50,
  "pending_reports": 3
}
```

### 检举

#### GET /api/admin/reports — 检举列表

等同 `GET /api/reports/`，需要管理员权限。

#### PUT /api/admin/reports/{id} — 处理检举

等同 `PUT /api/reports/{id}`，需要管理员权限。

---

## 检举

### POST /api/reports/ — 提交检举

需要登入。

```
Body: {
  "target_type": "item",          // string, item|user
  "target_id": 1,                 // int, 必填
  "reason": "不當內容"             // string, 必填
}
Response 200: { "detail": "已提交舉報", "id": 1 }
```

### GET /api/reports/ — 检举列表

需要管理员权限。

| 参数 | 类型 | 预设值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量 |
| status | string | - | pending / resolved / dismissed |

### PUT /api/reports/{id} — 处理检举

需要管理员权限。

```
Body: {
  "status": "resolved",           // string, resolved|dismissed
  "note": "處理備註"               // string, 可选
}
Response 200: { "detail": "已更新" }
```

---

## 错误响应格式

所有错误响应遵循统一格式：

```json
{
  "detail": "错误描述訊息"
}
```

HTTP 状态码：
- `400` — 请求参数无效
- `401` — 未登入或 Token 过期
- `403` — 权限不足
- `404` — 资源不存在
- `500` — 服务器内部错误
