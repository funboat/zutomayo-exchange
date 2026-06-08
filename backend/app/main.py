from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.config import settings
from app.database import engine
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.items import router as items_router
from app.api.upload import router as upload_router
from app.api.exchanges import router as exchanges_router
from app.api.messages import router as messages_router
from app.api.favorites import router as favorites_router
from app.api.reviews import router as reviews_router
from app.api.reports import router as reports_router
from app.api.notifications import router as notifications_router
from app.api.users import router as users_router
from app.api.categories import router as categories_router


UPLOADS_DIR = Path(settings.upload_dir).resolve()


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    yield
    await engine.dispose()


app = FastAPI(title="ZUTOMAYO Exchange", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

routers = [
    (auth_router, "/api"),
    (admin_router, "/api"),
    (items_router, "/api"),
    (upload_router, "/api"),
    (exchanges_router, "/api"),
    (messages_router, "/api"),
    (favorites_router, "/api"),
    (reviews_router, "/api"),
    (reports_router, "/api"),
    (notifications_router, "/api"),
    (users_router, "/api"),
    (categories_router, "/api"),
]
for router, prefix in routers:
    app.include_router(router, prefix=prefix)


FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve static frontend assets
app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
app.mount("/uploads/items", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    # Don't intercept API or static asset paths
    if full_path.startswith("api/") or full_path.startswith("css/") or full_path.startswith("js/") or full_path.startswith("uploads/"):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"detail": "Frontend not found"}, status_code=404)
