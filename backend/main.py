"""
CascadeRecover AI — FastAPI Application Entry Point
Razorpay AI Buildathon 2024 | Track 3: AI Revenue Recovery
"""
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from database import init_db
from routers.simulator import router as simulator_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — initialize DB on startup."""
    logger.info("🚀 CascadeRecover AI starting up...")
    init_db()
    logger.info("✅ Database initialized")
    yield
    logger.info("🛑 CascadeRecover AI shutting down...")


app = FastAPI(
    title="CascadeRecover AI",
    description="Autonomous AI Revenue Recovery System — Razorpay AI Buildathon 2024",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(simulator_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "CascadeRecover AI",
        "version": "1.0.0",
        "status": "operational",
        "buildathon": "Razorpay AI Buildathon 2024 — Track 3",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "CascadeRecover AI"}
