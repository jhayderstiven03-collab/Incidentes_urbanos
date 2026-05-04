# 🏙️ Urban Incidents - Pamplona
> Plataforma profesional de monitoreo y reporte de incidentes urbanos para la ciudad de Pamplona, Norte de Santander.

![CI](https://github.com/charlykj/urban-incidents/actions/workflows/ci.yml/badge.svg)

---

## 📌 Descripción

**Urban Incidents** es una herramienta exclusiva para el monitoreo del territorio de **Pamplona**. Permite a los ciudadanos reportar incidentes urbanos con geolocalización precisa y visualizarlos en tiempo real mediante mapas de calor y marcadores interactivos. Los datos se gestionan de forma eficiente en **Amazon DynamoDB**.

### ✨ Características Principales
- **📍 Geofencing:** Restricción de operaciones al límite municipal de Pamplona.
- **📊 Analytics:** Dashboard con gráficos estadísticos (Recharts) sobre categorías, zonas y prioridades.
- **🔥 Heatmaps:** Visualización de zonas críticas mediante mapas de calor.
- **🎨 UI Moderna:** Interfaz accesible (WCAG AA), responsive y con micro-animaciones.
- **✅ Validación:** Formulario con validación en tiempo real y selección intuitiva en mapa.

---

## 🧱 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19 + Vite + Leaflet + Recharts |
| **Backend** | FastAPI + Python 3.14 + Pydantic |
| **Base de Datos** | Amazon DynamoDB (NoSQL) |
| **Infraestructura** | Docker + Docker Compose + Nginx |
| **Documentación** | [Arquitectura](./ARCHITECTURE.md) \| [Mejoras UI](./MEJORAS_UI.md) |

---

## 🚀 Inicio Rápido

### Opción 1 – Docker (Recomendado)

```bash
git clone https://github.com/charlykj/urban-incidents.git
cd urban-incidents
docker-compose up
```

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8080
- **Docs:** http://localhost:8080/docs

### Opción 2 – Desarrollo Manual

**1. DynamoDB Local:**
```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

**2. Backend:**
```bash
cd backend
python -m venv venv
./venv/Scripts/activate # Windows
pip install -r requirements.txt
uvicorn main:app --port 8080 --reload
```

**3. Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Variables de Entorno

Crea `backend/.env`:

```env
# Desarrollo local
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_DEFAULT_REGION=us-east-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local

# Producción (AWS real)
# AWS_ACCESS_KEY_ID=tu_access_key
# AWS_SECRET_ACCESS_KEY=tu_secret_key
```

---

## 🔌 API Endpoints

**Base URL:** `http://localhost:8080`

### 📋 Incidentes
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/incidents/` | Crear nuevo reporte |
| `GET` | `/incidents/` | Listar todos los incidentes |
| `GET` | `/incidents/{ciudad}/{zona}` | Filtrar por zona específica |
| `PUT` | `/incidents/{ciudad_zona}/{fecha_id}` | Actualizar estado/datos |
| `DELETE` | `/incidents/{ciudad_zona}/{fecha_id}` | Eliminar reporte |

### 📈 Analíticas
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/analytics/summary` | Resumen general de estadísticas |
| `GET` | `/analytics/categories` | Distribución por tipo de incidente |
| `GET` | `/analytics/priorities` | Conteo por niveles de prioridad |
| `GET` | `/analytics/zones` | Frecuencia de incidentes por zona |

---

## 💾 Modelo de Datos (DynamoDB)

**Tabla:** `Incidentes`

- **Partition Key (`PK`):** `CiudadZona` (Ej: `Pamplona#Norte`)
- **Sort Key (`SK`):** `FechaID` (Ej: `2024-05-02#uuid`)
- **GSIs:** `categoria-index`, `estado-index`.

---

## 📁 Estructura del Proyecto

```
urban-incidents/
├── backend/
│   ├── routes/              # Endpoints (Incidents, Analytics)
│   ├── db/dynamo.py         # Lógica de conexión Boto3
│   └── tests/               # Pruebas unitarias/integración
├── frontend/
│   ├── src/components/      # UI: Formulario, Lista, Mapa, Stats
│   └── src/App.jsx          # Orquestador principal
├── ARCHITECTURE.md          # Diagramas Mermaid
└── MEJORAS_UI.md            # Registro de evolución UX/UI
```

---

## 👥 Equipo – Grupo 4
| Integrante | Rol / Especialidad |
|-----------|--------------------|
| **Jhayder Flórez** | Backend & DynamoDB Architect |
| **Carlos Camargo** | Frontend & UX/UI Lead |
| **Camilo Torres** | DevOps & Cloud Integration |
| **Jhoana Zambrano** | QA & Documentation |

**Universidad de Pamplona** – Ingeniería de Sistemas 2025-2
**Bases de Datos II** – Prof. Juan Alejandro Carrillo Jaimes
