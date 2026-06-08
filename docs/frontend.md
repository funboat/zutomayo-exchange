# ZUTOMAYO 無料交換 — 前端文檔

## 技術概覽

- **技術棧**: 原生 HTML/CSS/JavaScript，零框架 SPA
- **路由**: Hash-based (`#/`)，自訂簡易路由器
- **API 通訊**: Fetch API + JWT 自動附加，401 自動刷新 token 並重試
- **狀態管理**: 全域 `state` 物件 + localStorage 持久化
- **主題**: ZTMY 暗黑風格（深黑 `#09090b` + 粉紫 `#d946ef` + 紫色 `#8b5cf6`）

## 檔案結構

```
frontend/
├── index.html          # SPA 殼（單一 HTML 入口）
├── css/
│   └── style.css       # 全局樣式（~780 行 ZTMY 主題）
└── js/
    └── app.js          # 完整應用邏輯（~1700 行）
```

---

## 路由表（20 條）

| 路徑 | 頁面 | 需要登入 | 需要管理員 |
|------|------|:---:|:---:|
| `#/` | 首頁（演唱會資訊 + 最新物品） | | |
| `#/login` | 登入 | | |
| `#/register` | 註冊（需邀請碼） | | |
| `#/items` | 物品瀏覽（篩選 + 分頁） | | |
| `#/items/new` | 發佈物品 | ✓ | |
| `#/items/:id` | 物品詳情 | | |
| `#/items/:id/edit` | 編輯物品 | ✓ | |
| `#/profile/me` | 我的個人資料 | ✓ | |
| `#/profile/:id` | 用戶公開資料 | | |
| `#/my-items` | 我的物品 | ✓ | |
| `#/exchanges` | 我的交換 | ✓ | |
| `#/exchanges/:id` | 交換詳情 | ✓ | |
| `#/messages` | 訊息列表 | ✓ | |
| `#/messages/:exchangeId` | 訊息討論串（聊天 UI） | ✓ | |
| `#/favorites` | 我的收藏 | ✓ | |
| `#/notifications` | 通知列表 | ✓ | |
| `#/notice/:id` | 通知詳情（如物品刪除通知） | ✓ | |
| `#/admin/invite-codes` | 管理邀請碼 | ✓ | ✓ |
| `#/admin/reports` | 管理檢舉 | ✓ | ✓ |
| `#/admin/categories` | 管理物品類別 | ✓ | ✓ |

---

## 全域狀態

```javascript
state = {
  user: null | { id, nickname, is_admin, email, ... },
  accessToken: '',       // JWT，localStorage: access_token
  refreshToken: '',      // JWT，localStorage: refresh_token
  unreadMessages: 0,     // 未讀訊息數
  unreadNotifications: 0 // 未讀通知數
}
```

- **持久化**: `access_token` 和 `refresh_token` 存在 localStorage
- **初始化**: 頁面載入時呼叫 `checkAuth()` 從 token 恢復 session
- **Token 刷新**: API 收到 401 時自動用 refresh token 換新 access token
- **登出**: 清除 state + localStorage，跳轉 `#/login`

---

## API 客戶端

`api(path, options)` — 核心請求函數。

- 自動加上 `/api` 前綴
- 自動附加 `Authorization: Bearer <token>`
- 自動處理 JSON body（`Content-Type: application/json`）
- `FormData` body（圖片上傳）不做 JSON 序列化
- 401 時自動刷新 token 並重試一次
- 非 OK 回應拋出 `{ status, detail }` 物件

---

## 導航列

**未登入：**
- 瀏覽 → `#/items`
- 登入 → `#/login`
- 註冊 → `#/register`

**已登入：**
- 瀏覽 → `#/items`
- 發佈 → `#/items/new`
- 交換 → `#/exchanges`
- 訊息 → `#/messages`（附未讀數徽章）
- 通知 → `#/notifications`（附未讀數徽章）
- 收藏 → `#/favorites`
- `{暱稱}` → `#/profile/me`
- 管理（僅管理員，下拉選單：邀請碼 / 舉報 / 類別）
- 登出（按鈕）

手機版有漢堡選單 (`#menuToggle`)。

**啟用狀態**：當前頁面對應的導航連結使用漸層文字效果（`background: linear-gradient(...); -webkit-background-clip: text`），透過 `data-nav` 屬性 + hash 模式比對來判定。

---

## 頁面功能詳情

### 首頁 `#/`

- Hero 區塊（演唱會海報風格：ZUTOMAYO 品牌 + CTA 按鈕 + 活動日期地點 + 分享按鈕）
- Canvas 粒子動畫背景
- 倒數計時區（距離開演）
- 演唱會資訊卡片（日期、場地、票價、售票平台、交通、注意事項）
- 人氣曲目列表
- Music Video 嵌入區（YouTube 懶載入）
- ZUTOMAYO 介紹
- 常見問題（FAQ 折疊面板）
- 最新物品區（GET `/items/?page_size=8&sort_by=newest`），最多 8 張物品卡片
- 頁尾社群連結（YouTube、X、Instagram、官網）

### 物品瀏覽 `#/items`

- 篩選欄：關鍵字搜尋（300ms debounce）、分類、交換方式、狀態、排序
- 物品卡片網格 + 分頁
- 預設顯示 `status=available` 的物品

### 物品詳情 `#/items/:id`

- 主圖 + 縮圖庫（點擊切換主圖）
- 物品資訊：標題、分類、交換方式、狀態、描述、想換物品、庫存數量
- 擁有者頭像 + 暱稱（點擊進入其公開資料頁）
- **收藏切換**：已登入非擁有者可收藏/取消
- **發起交換**：已登入非擁有者可對 `available` 且有庫存的物品發起交換請求
  - 互換（swap）模式：必須選擇自己的一件可用物品作為交換
  - 伸手（reach_out）模式：直接發送請求，無需提供物品
- **編輯**：擁有者顯示編輯按鈕
- **狀態切換**：擁有者可切換 available ↔ reserved
- **刪除**：擁有者或管理員可刪除（管理員刪除他人物品需填寫理由）
- **舉報**：非擁有者可舉報物品

### 發佈物品 `#/items/new`

表單欄位：
- 標題（必填，最多 200 字）
- 描述
- 類別：CD / 周邊 / 海報 / 其他（動態從 API 載入）
- 交換方式：互換 / 伸手
- 想換物品
- 庫存數量（留空 = 無限庫存，自訂 +/- 按鈕）
- 圖片上傳器（最多 5 張，每張最大 5MB，支援 JPG/PNG/WebP/GIF，伺服器裁切為 1:1）

### 編輯物品 `#/items/:id/edit`

- 預填現有資料的表單（欄位同發佈頁面）
- 需要是物品擁有者

### 我的物品 `#/my-items`

- 顯示當前用戶所有物品（含已交換/已預留）
- 每張卡片下方有：狀態切換、編輯、刪除按鈕

### 我的交換 `#/exchanges`

- 篩選分頁：全部 / 已發送 / 已收到
- 每筆顯示狀態標籤、對方資訊（伸手索要 / 想要 / 提供互換）、時間

### 交換詳情 `#/exchanges/:id`

- 狀態標籤 + 雙方資訊（含交換方式標籤）
- 操作按鈕（根據角色和狀態顯示）：
  - **接受**：to_user，狀態為 pending
  - **拒絕**：to_user，狀態為 pending
  - **取消**：from_user，狀態為 pending
  - **標記完成**：任一方，狀態為 accepted
  - **查看訊息**：任何時候

### 訊息列表 `#/messages`

- 列出進行中的交換（非 completed/cancelled）
- 點擊進入討論串

### 訊息討論串 `#/messages/:exchangeId`

- 聊天 UI：訊息氣泡（自己的靠右、對方靠左）
- 顯示發送者 + 時間
- 輸入框 + 發送按鈕（支援 Enter 快捷）
- 每 8 秒自動輪詢新訊息

### 收藏 `#/favorites`

- 收藏物品卡片網格 + 分頁
- 每張卡片下方有取消收藏按鈕

### 通知 `#/notifications`

- 通知列表 + 分頁
- 未讀通知有左側邊框標示
- 點擊通知：標記已讀 + 跳轉到相關頁面（交換通知 → 交換詳情，訊息通知 → 聊天頁，刪除通知 → 通知詳情頁）
- 「全部已讀」按鈕

### 通知詳情 `#/notice/:id`

- 顯示通知完整內容（如物品被刪除的通知）
- 自動標記已讀

### 用戶資料 `#/profile/:id`

- 頭像（暱稱首字或上傳的頭像圖片）+ 暱稱、物品數、平均評分、加入日期
- 自己的頁面可編輯頭像（點擊上傳）和暱稱（點擊編輯按鈕）
- 非自己頁面可舉報用戶
- Tab 切換：物品 / 評價（星級 + 評論）

### 管理邀請碼 `#/admin/invite-codes`

- 生成表單：數量（1-50）+ 前綴（預設 ZTMY）
- 邀請碼列表：代碼、狀態（已用/未用）、使用者 ID、建立時間

### 管理檢舉 `#/admin/reports`

- 檢舉列表 + 分頁
- 每筆顯示：檢舉者、目標類型與 ID、原因、狀態
- 待處理檢舉有「標記已處理」和「駁回」按鈕

### 管理類別 `#/admin/categories`

- 新增類別表單：Key（英文標識）、Label（顯示名稱）、排序
- 類別列表：Key、Label、排序、啟用狀態
- 每個類別可編輯（行內編輯 Label 和排序）、啟用/停用、刪除

---

## 輔助函數

| 函數 | 用途 |
|------|------|
| `escHtml(s)` | HTML 實體轉義（`& < > "`） |
| `formatDate(d)` | 日期格式化（zh-HK locale） |
| `formatDateTime(d)` | 日期時間格式化（zh-HK locale） |
| `tag(s, cls)` | 渲染標籤 `<span class="tag">` |
| `statusBadge(s)` | 渲染狀態徽章（中文字） |
| `itemCard(item)` | 渲染物品卡片 HTML（含圖片、標題、3 個標籤、庫存、擁有者） |
| `pagination(page, total, cb)` | 渲染分頁控制 |
| `filterBar(filters)` | 渲染物品篩選欄 |
| `loadingSpinner()` | 渲染載入動畫 |
| `toast(msg, type)` | 顯示 Toast 通知（3秒消失） |
| `showConfirm(opts)` | 渲染確認對話框，回傳 Promise |
| `renderImageUploader(images)` | 圖片上傳器組件 |

### 標籤映射

| 分類 | 顯示 | 交換方式 | 顯示 | 狀態 | 顯示 |
|------|------|------|------|------|------|
| cd | CD | swap | 需互換 | available | 可交換 |
| goods | 周邊 | reach_out | 可伸手 | reserved | 已預留 |
| poster | 海報 | | | exchanged | 已交換 |
| other | 其他 | | | deleted | (已刪除) |

交換狀態徽章：`pending` 待確認 / `accepted` 已接受 / `rejected` 已拒絕 / `cancelled` 已取消 / `completed` 已完成

通知類型：`exchange_request` 交換請求 / `exchange_accepted` 已接受 / `exchange_rejected` 已拒絕 / `exchange_completed` 已完成 / `new_message` 新訊息 / `new_review` 新評價 / `item_deleted` 物品已刪除

---

## CSS 主題變數

```css
:root {
  --bg: #09090b;                    /* 深黑背景 */
  --bg-surface: #121214;
  --bg-card: #18181b;
  --bg-card-hover: #1f1f23;
  --bg-input: #18181b;
  --bg-hover: #1f1f23;
  --text: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent: #d946ef;                /* 粉紫主色 */
  --accent-glow: rgba(217, 70, 239, 0.35);
  --accent-secondary: #8b5cf6;      /* 紫色輔色 */
  --cyan: #22d3ee;                  /* 青色（交換方式標籤） */
  --border: #27272a;
  --border-light: #3f3f46;
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;
}
```

### 組件樣式

| 組件 | 樣式特徵 |
|------|------|
| 按鈕（btn） | 圓角藥丸形、邊框透明、hover 上移 |
| 主要按鈕（btn-primary） | 漸層背景 `#8b5cf6 → #d946ef` + glow 陰影 |
| 次要按鈕（btn-secondary） | 透明背景 + 紫色邊框 |
| 表單輸入 | 深色背景、focus 時粉紫邊框 + glow |
| 自訂下拉（cusel） | 取代原生 select，展開動畫 + hover 縮排 |
| 物品卡片（item-card） | 1:1 主圖、hover 放大 + 上浮 |
| 標籤（tag） | 小圓角藥丸、半透明彩色背景 |
| tag-mode | 青色主題，標示交換方式 |
| 狀態徽章（status-badge） | 粗體文字、對應狀態顏色 |
| 頭像圓圈（avatar-circle） | 漸層背景，顯示頭像或暱稱首字 |
| 導航列（app-header） | 毛玻璃效果（`backdrop-filter: blur(12px)`） |
| 自訂捲軸 | 6px 寬、深色、圓角 |
| Glow Orbs | 固定定位大圓形、模糊濾鏡、背景氛圍 |

特效：
- 毛玻璃 header（`backdrop-filter: blur(12px)`）
- 卡片 hover 上浮（`translateY(-3px)`）+ 圖示放大
- 主要按鈕 glow box-shadow
- 自訂滾動條（6px 寬、深色）
- 徑向漸變背景氛圍（兩個 glow orb）
- 淡入上移動畫（`.anim-fade-up` + IntersectionObserver）
- 漢堡選單（手機版展開動畫）

---

## 互動流程

### 交換發起流程

1. 使用者 A 在物品詳情頁點擊「請求互換」或「伸手索要」
2. 若為互換模式：前端透過 API 取得使用者 A 的可用物品列表，渲染下拉選單
3. 若使用者 A 沒有可用物品（互換模式）：顯示提示，引導先發佈物品
4. 使用者填寫選填訊息，點擊發送
5. 前端 POST `/api/exchanges/`，攜帶 `to_item_id`、`message`、`from_item_id`（互換時）
6. 成功後顯示 toast，隱藏表單

### 通知輪詢

- 已登入用戶每 30 秒輪詢 `/api/notifications/unread-count` 和 `/api/messages/unread-count`
- 更新導航列上的未讀數徽章

### 圖片上傳

- 選擇檔案 → 前端即時 POST `/api/upload/image`（FormData）
- 成功後將返回的 URL 加入 `images` 陣列
- 可移除已上傳圖片（僅從陣列移除，不呼叫刪除 API）
- 提交表單時一併送出 `images` 陣列

---

## 啟動流程

1. `DOMContentLoaded` → `checkAuth()` 從 localStorage 恢復 token，取得使用者資訊
2. 同時 `loadCategories()` 載入分類列表
3. `navigate()` 解析當前 `location.hash`，匹配路由
4. 顯示 loading spinner
5. 執行頁面 handler（可能需要 API 請求）
6. 渲染導航列（含啟用狀態標示）
7. 初始化 IntersectionObserver（動畫）、MutationObserver（自訂下拉同步）
8. 如已登入，啟動 30 秒輪詢檢查未讀通知和訊息數
9. 監聽 `hashchange` 事件，路由變化時重新 `navigate()`
