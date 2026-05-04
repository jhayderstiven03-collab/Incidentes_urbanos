from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.dynamo import create_table_if_not_exists
from routes.incidents import router as incidents_router
from routes.analytics import router as analytics_router

app = FastAPI(
    title="Urban Incidents API",
    description="Plataforma de monitoreo y reporte de incidentes urbanos con DynamoDB",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    create_table_if_not_exists()

app.include_router(incidents_router)
app.include_router(analytics_router)

@app.get("/")
def root():
    return {"status": "ok", "mensaje": "Urban Incidents API corriendo 🚀"}