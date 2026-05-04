# 🏙️ Urban Incidents - Plataforma de Gestión Urbana (Pamplona)

## Jhayder Florez

**Urban Incidents** es una solución tecnológica de nivel profesional diseñada para el municipio de Pamplona, Colombia. La plataforma permite una colaboración híbrida entre ciudadanos y autoridades para el reporte y gestión de incidentes urbanos en tiempo real.

![CI Status](https://img.shields.io/github/actions/workflow/status/jhayderstiven03-collab/Incidentes_urbanos/ci.yml?branch=main&label=CI%20Pipeline)
![DB](https://img.shields.io/badge/Database-DynamoDB_Cloud-orange)
![Backend](https://img.shields.io/badge/Backend-FastAPI-green)
![Frontend](https://img.shields.io/badge/Frontend-React_19-blue)

---

## ✨ Características Principales

### 🗺️ Experiencia Geográfica Premium
- **Mapa Interactivo:** Interfaz de pantalla completa basada en Leaflet con diseño Glassmorphism.
- **Geocodificación Automática:** Los ciudadanos pueden seleccionar la ubicación exacta en el mapa y obtener la dirección automáticamente.
- **Zonificación Crítica:** Mapa de calor (Heatmap) integrado para identificar áreas con mayor concentración de reportes.
- **Restricción Territorial:** Operaciones geocercadas estrictamente al perímetro urbano de Pamplona.

### 👥 Gestión Institucional y Ciudadana
- **Modelo de Roles:** Acceso diferenciado para Ciudadanos, Operadores, Supervisores y Administradores.
- **Evidencias Multimedia:** Captura y carga de fotos (hasta 3 por reporte) con **compresión inteligente** en el cliente para optimizar costos de almacenamiento.
- **Trazabilidad Total:** Historial detallado de cambios de estado y auditoría de acciones administrativas.

---

## 🛠️ Stack Tecnológico Moderno

- **Frontend:** React 19 + Vite, Leaflet, Axios, Context API para estado global.
- **Backend:** Python 3.11 + FastAPI con arquitectura asíncrona y Lifespan Context Manager.
- **Base de Datos:** Amazon DynamoDB (NoSQL gestionado en la nube).
- **Código y Calidad:** 
  - **Linter (Backend):** Ruff (estándares PEP 8).
  - **Linter (Frontend):** ESLint con reglas de Fast Refresh.
  - **Seguridad:** Bandit (análisis de vulnerabilidades).
  - **Pruebas:** Pytest con reportes de cobertura.

---

## 🚀 Pipeline de CI/CD y Despliegue

El proyecto cuenta con un flujo de **Integración y Despliegue Continuo** automatizado mediante GitHub Actions:

1.  **Validación:** Cada commit es analizado por Ruff, Bandit y ESLint.
2.  **Pruebas:** Ejecución de tests unitarios y de integración con reportes de cobertura (Codecov).
3.  **Build:** Generación de imágenes Docker para servicios backend y frontend.
4.  **Despliegue:** 
    - **Backend:** Web Service en **Render** (Dockerizado).
    - **Frontend:** Static Site en **Render** (Optimizado para CDN).

---

## 📂 Configuración del Entorno

Para producción, las variables se gestionan mediante **GitHub Secrets**:
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`: Credenciales de DynamoDB Cloud.
- `AWS_REGION`: Región de la base de datos.
- `JWT_SECRET`: Clave secreta para la firma de tokens de seguridad.
- `RENDER_DEPLOY_HOOK_*`: Webhooks para automatizar el despliegue.

---

## 🖥️ Estructura del Proyecto

```text
├── .github/workflows/ # Pipeline de CI/CD automatizado
├── backend/
│   ├── db/            # Lógica de DynamoDB Cloud
│   ├── models/        # Esquemas Pydantic V2
│   ├── routes/        # Controladores (Auth, Incidents, Admin, Analytics)
│   └── tests/         # Suite de pruebas Pytest
├── frontend/
│   ├── src/
│   │   ├── AuthContext.js # Gestión de estado de sesión (HMR ready)
│   │   ├── AdminPanel.jsx # Interfaz institucional
│   │   └── App.jsx        # Dashboard principal y mapas
│   └── vite.config.js
└── docker-compose.yml # Orquestación local para desarrollo
```

---
*Desarrollado para la asignatura de Base de Datos II - 2026*
