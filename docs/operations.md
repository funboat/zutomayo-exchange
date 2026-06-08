# ZUTOMAYO Exchange — 运维信息

> 最后更新：2026-06-08

---

## 一、数据库

| 项目 | 值 |
|---|---|
| 数据库类型 | PostgreSQL |
| 连接地址 | `localhost:5432` |
| 数据库名 | `zutomayo` |
| 用户名 | `zutomayo` |
| 密码 | `zutomayo` |
| 连接字符串 | `postgresql+asyncpg://zutomayo:zutomayo@localhost:5432/zutomayo` |

**连接方式：**
```bash
PGPASSWORD=zutomayo psql -h localhost -U zutomayo -d zutomayo
```

> 配置文件：`backend/app/config.py`（可通过 `backend/.env` 覆盖 `DATABASE_URL`）

---

## 二、管理员账号

| 项目 | 值 |
|---|---|
| 邮箱 | `admin@zutomayo.dev` |
| 默认密码 | `zutomayo2024` |
| 昵称 | 管理員 |
| 权限 | `is_admin = True` |

**创建 / 重置：**
```bash
cd backend
source venv/bin/activate
python seed.py --email admin@zutomayo.dev --password zutomayo2024 --nickname 管理員
```

> `seed.py` 同时生成 10 个邀请码（格式 `ZTMY-xxxxxxxx`）。

---

## 三、JWT 配置

| 项目 | 值 |
|---|---|
| 签名密钥 | `change-me-to-a-random-secret-at-least-32-chars` |
| 算法 | `HS256` |
| Access Token 有效期 | 30 分钟 |
| Refresh Token 有效期 | 7 天 |

> **部署后务必修改 `JWT_SECRET`**，在 `backend/.env` 中设置。

---

## 四、应用服务

| 项目 | 值 |
|---|---|
| 启动命令 | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` |
| 监听端口 | `8000` |
| Python 虚拟环境 | `backend/venv/` |
| 工作目录 | `/home/funo/zutomayo-exchange/backend` |

**启动：**
```bash
cd /home/funo/zutomayo-exchange/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 五、快速检查

| 检查项 | 命令 |
|---|---|
| 后端健康检查 | `curl -s http://localhost:8000/api/health` |
| Swagger 文档 | 浏览器打开 `http://localhost:8000/docs` |
| 数据库连接 | `PGPASSWORD=zutomayo psql -h localhost -U zutomayo -d zutomayo -c "SELECT count(*) FROM users;"` |
| 管理员登录 | `curl -s -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@zutomayo.dev","password":"zutomayo2024"}'` |
