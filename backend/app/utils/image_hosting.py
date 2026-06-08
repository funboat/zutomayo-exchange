import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps
from fastapi import UploadFile, HTTPException

from app.config import settings


async def save_avatar(file: UploadFile) -> str:
    if file.content_type not in settings.allowed_image_types:
        raise HTTPException(400, "不支援的圖片格式，僅接受 JPG/PNG/WebP/GIF")

    content = await file.read()
    if len(content) > settings.max_image_size:
        raise HTTPException(400, "圖片過大，最大 5MB")

    try:
        img = Image.open(BytesIO(content))
        img = ImageOps.exif_transpose(img)
    except Exception:
        raise HTTPException(400, "無法識別的圖片格式")

    try:
        if img.mode in ("RGBA", "P", "LA"):
            if img.mode == "P":
                img = img.convert("RGBA")
            img = img.convert("RGB")

        # Center-crop to 1:1
        w, h = img.size
        size = min(w, h)
        left = (w - size) // 2
        top = (h - size) // 2
        img = img.crop((left, top, left + size, top + size))

        # Resize to 256px
        if size > 256:
            img = img.resize((256, 256), Image.LANCZOS)

        filename = f"avatars/{uuid.uuid4().hex}.jpg"
        upload_path = Path(settings.upload_dir)
        upload_path.mkdir(parents=True, exist_ok=True)
        (upload_path / "avatars").mkdir(parents=True, exist_ok=True)
        filepath = upload_path / filename

        img.save(filepath, format="JPEG", quality=85, optimize=True)
    except Exception:
        raise HTTPException(400, "圖片處理失敗，請嘗試其他圖片")

    return f"/uploads/items/{filename}"


async def save_image(file: UploadFile) -> str:
    if file.content_type not in settings.allowed_image_types:
        raise HTTPException(400, "不支援的圖片格式，僅接受 JPG/PNG/WebP/GIF")

    content = await file.read()
    if len(content) > settings.max_image_size:
        raise HTTPException(400, "圖片過大，最大 5MB")

    try:
        img = Image.open(BytesIO(content))
        img = ImageOps.exif_transpose(img)
    except Exception:
        raise HTTPException(400, "無法識別的圖片格式")

    try:
        if img.mode in ("RGBA", "P", "LA"):
            if img.mode == "P":
                img = img.convert("RGBA")
            img = img.convert("RGB")

        # Center-crop to 1:1
        w, h = img.size
        size = min(w, h)
        left = (w - size) // 2
        top = (h - size) // 2
        img = img.crop((left, top, left + size, top + size))

        # Resize if larger than max dimension
        if size > settings.max_image_dimension:
            img = img.resize((settings.max_image_dimension, settings.max_image_dimension), Image.LANCZOS)

        ext = file.filename.split(".")[-1].lower() if file.filename else "jpg"
        if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
            ext = "jpg"

        filename = f"{uuid.uuid4().hex}.{ext}"
        upload_path = Path(settings.upload_dir)
        upload_path.mkdir(parents=True, exist_ok=True)
        filepath = upload_path / filename

        if ext in ("jpg", "jpeg"):
            fmt, qty = "JPEG", settings.image_quality
            img.save(filepath, format=fmt, quality=qty, optimize=True)
            while filepath.stat().st_size > settings.max_image_size and qty > 30:
                qty -= 10
                img.save(filepath, format=fmt, quality=qty, optimize=True)
        elif ext == "webp":
            fmt, qty = "WEBP", settings.image_quality
            img.save(filepath, format=fmt, quality=qty)
            while filepath.stat().st_size > settings.max_image_size and qty > 30:
                qty -= 10
                img.save(filepath, format=fmt, quality=qty)
        elif ext == "gif":
            img.save(filepath, format="GIF", optimize=True)
        else:
            img.save(filepath, format="PNG", optimize=True)
    except Exception:
        raise HTTPException(400, "圖片處理失敗，請嘗試其他圖片")

    return f"/uploads/items/{filename}"
