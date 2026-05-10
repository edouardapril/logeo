from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import get_settings
from app.database import engine, Base
from app.routers import (
    auth, admin, courtier, acheteur, payments, profile,
    storage as storage_router, reviews, public, realtime as realtime_router,
    partners as partners_router,
)
from app.services.auction import start_scheduler, stop_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Démarrer le scheduler d'enchères
    start_scheduler()
    yield
    # Arrêt propre
    stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title="Logeo API",
    description="Plateforme immobilière off-market au Québec",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://localhost:5174",
        "https://logeo-mu.vercel.app",
        "https://logeo.ca",
        "https://www.logeo.ca",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir les fichiers uploadés (PDFs) de manière statique
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(courtier.router, prefix="/api/v1")
app.include_router(acheteur.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(storage_router.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")
app.include_router(partners_router.router, prefix="/api/v1")
# WebSockets : pas de préfixe /api/v1, conventionnellement sous /ws/*
app.include_router(realtime_router.router)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "Logeo API"}
