# 🏙️ Urban Incidents - Plataforma de Gestión Urbana (Pamplona)

**Urban Incidents** es una solución tecnológica híbrida diseñada para la ciudad de Pamplona, Colombia. Permite a los ciudadanos reportar incidentes urbanos (vías, alumbrado, residuos, etc.) y a las autoridades gestionar, validar y resolver dichos reportes en tiempo real a través de una interfaz moderna basada en mapas.

![UI Preview](https://img.shields.io/badge/UI-Fullscreen_Map-blue)
![DB](https://img.shields.io/badge/Database-DynamoDB_Cloud-orange)
![Backend](https://img.shields.io/badge/Backend-FastAPI-green)

---

## ✨ Características Principales

### 🗺️ Experiencia de Usuario (UX)
- **Mapa a Pantalla Completa:** Interfaz centrada en la ubicación para una navegación intuitiva.
- **Geocodificación Inteligente:** Autocompletado de dirección mediante clic derecho en el mapa.
- **Restricción Geográfica:** Operaciones limitadas exclusivamente al municipio de Pamplona.
- **Mapa de Calor:** Visualización de zonas críticas mediante intensidades de incidentes.

### 👥 Modelo Híbrido Ciudadano-Institucional
- **Autenticación Obligatoria:** Registro con validación de teléfono y dirección residencial.
- **Roles de Usuario:** Ciudadanos (reportan), Operadores (gestionan), Supervisores y Administradores (auditan).
- **Gestión de Evidencias:** Soporte para hasta 3 imágenes por reporte con **compresión automática** en el cliente para optimizar el almacenamiento.

### 🏛️ Panel Administrativo Avanzado
- **Flujo de Estados:** Trazabilidad completa desde `reportado` hasta `resuelto` o `cerrado`.
- **Auditoría:** Registro detallado de todas las acciones críticas realizadas por funcionarios.
- **Asignación de Entidades:** Capacidad de delegar incidentes a secretarías responsables.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React + Vite, Leaflet (Mapas), Axios, Vanilla CSS (Premium Design).
- **Backend:** Python + FastAPI, Pydantic (Validación).
- **Base de Datos:** Amazon DynamoDB (NoSQL de alta disponibilidad).
- **Despliegue:** Docker & Docker Compose.

---

## 🚀 Instalación y Ejecución

### Requisitos Previos
- Docker y Docker Compose instalados.
- Archivo `.env` configurado con credenciales de AWS (DynamoDB).

### Pasos para iniciar
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/charlykj/urban-incidents.git
   ```
2. Iniciar con Docker Compose:
   ```bash
   docker-compose up --build -d
   ```
3. Acceder a la plataforma:
   - **Frontend:** `http://localhost:3000`
   - **Backend API:** `http://localhost:8080/docs`

---

## 📂 Estructura del Proyecto

```text
├── backend/
│   ├── routes/        # Endpoints de incidentes, auth y admin
│   ├── models/        # Esquemas de datos Pydantic
│   ├── db/            # Conexión y utilidades de DynamoDB
│   └── main.py        # Punto de entrada FastAPI
├── frontend/
│   ├── src/
│   │   ├── App.jsx    # Interfaz principal y mapa
│   │   ├── AdminPanel # Gestión institucional
│   │   └── useAuth    # Estado global de sesión
│   └── nginx.conf     # Configuración del servidor de producción
└── docker-compose.yml
```

---

## 🛡️ Seguridad y Optimización
- **JWT:** Autenticación basada en tokens para rutas protegidas.
- **Compresión de Imágenes:** Las imágenes se procesan en el navegador (max 800px) para cumplir con el límite de 400KB de DynamoDB.
- **CORS:** Configurado para permitir comunicación segura entre contenedores.

---
*Desarrollado para la asignatura de Base de Datos II - 2024*
