# ZUTOMAYO Exchange — 数据库表定义

## 概览

| 表名 | 说明 |
|---|---|
| `users` | 用户 |
| `items` | 物品 |
| `categories` | 物品分类 |
| `exchange_requests` | 交换请求 |
| `messages` | 聊天消息 |
| `notifications` | 通知 |
| `reviews` | 评价 |
| `favorites` | 收藏 |
| `invitation_codes` | 邀请码 |
| `reports` | 举报 |

---

## 1. users（用户）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 用户 ID |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL, INDEX | 邮箱 |
| `password_hash` | `VARCHAR(255)` | NOT NULL | bcrypt 密码哈希 |
| `nickname` | `VARCHAR(100)` | NOT NULL | 昵称 |
| `avatar` | `VARCHAR(500)` | NULLABLE | 头像 URL |
| `invite_code_used` | `VARCHAR(50)` | NULLABLE | 注册时使用的邀请码 |
| `is_admin` | `BOOLEAN` | DEFAULT FALSE | 是否管理员 |
| `is_banned` | `BOOLEAN` | DEFAULT FALSE | 是否被封禁 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 注册时间 |

---

## 2. items（物品）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 物品 ID |
| `title` | `VARCHAR(200)` | NOT NULL | 标题 |
| `description` | `TEXT` | NULLABLE | 描述 |
| `images` | `JSONB` | DEFAULT [] | 图片 URL 数组 |
| `category` | `VARCHAR(50)` | NOT NULL, INDEX | 分类 key，关联 categories.key |

| `status` | `VARCHAR(50)` | DEFAULT 'available', INDEX | 状态：available / reserved / exchanged / deleted |
| `exchange_mode` | `VARCHAR(50)` | DEFAULT 'swap', NOT NULL | 交换方式：reach_out（伸手）/ swap（互换） |
| `owner_id` | `INTEGER` | FK → users.id, NOT NULL, INDEX | 持有者 |
| `wanted_items` | `TEXT` | NULLABLE | 期望换得的物品描述 |
| `stock` | `INTEGER` | DEFAULT 1, NULLABLE | 库存数量（null = 无限） |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW(), ON UPDATE NOW() | 更新时间 |

---

## 3. categories（分类）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 分类 ID |
| `key` | `VARCHAR(50)` | UNIQUE, NOT NULL, INDEX | 英文标识（cd / goods / poster / other） |
| `label` | `VARCHAR(50)` | NOT NULL | 显示名称（CD / 周邊 / 海報 / 其他） |
| `sort_order` | `INTEGER` | DEFAULT 0 | 排序权重 |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | 是否启用 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 创建时间 |

---

## 4. exchange_requests（交换请求）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 请求 ID |
| `from_user_id` | `INTEGER` | FK → users.id, NOT NULL, INDEX | 发起者 |
| `to_user_id` | `INTEGER` | FK → users.id, NOT NULL, INDEX | 接收者（物品持有者） |
| `from_item_id` | `INTEGER` | FK → items.id, NULLABLE | 发起者提供的物品（伸手时可为空） |
| `to_item_id` | `INTEGER` | FK → items.id, NOT NULL | 目标物品 |
| `status` | `VARCHAR(50)` | DEFAULT 'pending', INDEX | pending / accepted / rejected / cancelled / completed |
| `message` | `TEXT` | NULLABLE | 交换附言 |
| `cancel_reason` | `TEXT` | NULLABLE | 取消申请理由 |
| `cancel_requested_by` | `INTEGER` | FK → users.id, NULLABLE | 取消申请人 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW(), ON UPDATE NOW() | 更新时间 |

状态：`pending` / `accepted` / `rejected` / `cancelled` / `cancel_requested` / `completed`

---

## 5. messages（聊天消息）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 消息 ID |
| `sender_id` | `INTEGER` | FK → users.id, NOT NULL, INDEX | 发送者 |
| `receiver_id` | `INTEGER` | FK → users.id, NOT NULL, INDEX | 接收者 |
| `exchange_request_id` | `INTEGER` | FK → exchange_requests.id ON DELETE CASCADE, NOT NULL, INDEX | 所属交换请求 |
| `content` | `TEXT` | NOT NULL | 消息内容 |
| `is_read` | `BOOLEAN` | DEFAULT FALSE | 是否已读 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 发送时间 |

**已读逻辑**：用户打开聊天页时，该交换下所有 `receiver_id = 当前用户` 的消息 `is_read` 批量设为 `TRUE`。

**未读数**：`SELECT COUNT(*) FROM messages WHERE receiver_id = $uid AND is_read = FALSE`

---

## 6. notifications（通知）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 通知 ID |
| `user_id` | `INTEGER` | FK → users.id ON DELETE CASCADE, NOT NULL, INDEX | 接收者 |
| `type` | `VARCHAR(50)` | NOT NULL | 类型：exchange_request / exchange_accepted / exchange_rejected / exchange_completed / new_message / new_review / item_deleted |
| `content` | `TEXT` | NOT NULL | 通知文本 |
| `related_id` | `INTEGER` | NULLABLE | 关联对象 ID（如交换 ID） |
| `is_read` | `BOOLEAN` | DEFAULT FALSE | 是否已读 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 通知时间 |

---

## 7. reviews（评价）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 评价 ID |
| `exchange_request_id` | `INTEGER` | FK → exchange_requests.id, NOT NULL | 关联的交换请求 |
| `reviewer_id` | `INTEGER` | FK → users.id, NOT NULL | 评价者 |
| `reviewed_user_id` | `INTEGER` | FK → users.id, NOT NULL, INDEX | 被评价者 |
| `rating` | `INTEGER` | NOT NULL | 评分（1-5） |
| `comment` | `TEXT` | NULLABLE | 评价内容 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 评价时间 |

**唯一约束**：`(exchange_request_id, reviewer_id)` — 每次交换每方只能评价一次。

---

## 8. favorites（收藏）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `user_id` | `INTEGER` | FK → users.id ON DELETE CASCADE, PK | 用户 ID |
| `item_id` | `INTEGER` | FK → items.id ON DELETE CASCADE, PK | 物品 ID |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 收藏时间 |

联合主键 `(user_id, item_id)`，同一用户不能重复收藏同一物品。

---

## 9. invitation_codes（邀请码）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 记录 ID |
| `code` | `VARCHAR(50)` | UNIQUE, NOT NULL, INDEX | 邀请码 |
| `created_by` | `INTEGER` | FK → users.id, NULLABLE | 创建者 |
| `used_by` | `INTEGER` | FK → users.id, NULLABLE | 使用者 |
| `is_used` | `BOOLEAN` | DEFAULT FALSE | 是否已使用 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 创建时间 |

---

## 10. reports（举报）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | `INTEGER` | PK, INDEX | 举报 ID |
| `reporter_id` | `INTEGER` | FK → users.id, NOT NULL | 举报者 |
| `target_type` | `VARCHAR(50)` | NOT NULL | 举报对象类型（item / user） |
| `target_id` | `INTEGER` | NOT NULL | 举报对象 ID |
| `reason` | `TEXT` | NOT NULL | 举报原因 |
| `status` | `VARCHAR(50)` | DEFAULT 'pending', INDEX | 处理状态：pending / resolved / dismissed |
| `handled_by` | `INTEGER` | FK → users.id, NULLABLE | 处理者 |
| `note` | `TEXT` | NULLABLE | 处理备注 |
| `created_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW() | 举报时间 |
| `updated_at` | `TIMESTAMPTZ` | SERVER DEFAULT NOW(), ON UPDATE NOW() | 处理时间 |

---

## ER 关系概要

```
users ──1:N──> items                    (owner)
users ──1:N──> exchange_requests        (from_user / to_user)
users ──1:N──> messages                 (sender / receiver)
users ──1:N──> notifications            (user)
users ──1:N──> reviews                  (reviewer / reviewed_user)
users ──1:N──> favorites               (user)
users ──1:N──> reports                  (reporter / handler)
users ──1:N──> invitation_codes         (created_by / used_by)

items ──1:N──> exchange_requests        (from_item / to_item)
items ──1:N──> favorites               (item)

categories ── referenced by items.category (key)

exchange_requests ──1:N──> messages     (exchange_request_id)
exchange_requests ──1:N──> reviews      (exchange_request_id)
```
