from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from app.routers import auth, link, order, product, complaint, chat
from app.routers.connection import router as connection_router
from app.core.config import get_settings

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth)
app.include_router(link)
app.include_router(order)
app.include_router(product)
app.include_router(complaint)
app.include_router(chat)
app.include_router(connection_router)

# Static file mounting for uploaded assets
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/")
async def root():
    return {
        "message": "Supplier Consumer Platform API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
