# ============================================
# PrintRobot FastAPI Application
# Main entry point
# ============================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="PrintRobot API",
    description="Sistema de orquestación para granja de impresoras 3D",
    version="0.1.0"
)

# CORS Configuration
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Health Check Endpoint
# ============================================

@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "service": "PrintRobot API"
    }

# ============================================
# Root endpoint
# ============================================

@app.get("/", tags=["info"])
async def root():
    """Root endpoint"""
    return {
        "message": "PrintRobot API",
        "docs": "/docs",
        "version": "0.1.0"
    }

# ============================================
# Startup/Shutdown Events
# ============================================

@app.on_event("startup")
async def startup_event():
    print("🚀 PrintRobot API starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 PrintRobot API shutting down...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
