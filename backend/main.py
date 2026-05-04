from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.dynamo import create_all_tables
from routes.incidents import router as incidents_router
from routes.analytics import router as analytics_router
from routes.auth import router as auth_router
from routes.admin import router as admin_router

app = FastAPI(
    title="Urban Incidents API",
    description="Plataforma híbrida ciudadano-institucional de monitoreo urbano — Pamplona",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_all_tables()


app.include_router(auth_router)
app.include_router(incidents_router)
app.include_router(analytics_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "version": "2.0.0",
        "mensaje": "Urban Incidents API v2 — Plataforma Híbrida 🏙️",
    }