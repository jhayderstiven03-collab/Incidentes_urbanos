# 🚀 Guía de Despliegue: Urban Incidents en Render

Esta guía detalla los pasos necesarios para desplegar la plataforma completa (Frontend, Backend y Base de Datos) utilizando **Render** para los servicios web y **AWS DynamoDB** para la base de datos.

---

## 1. Configuración de la Base de Datos (AWS DynamoDB)

Dado que Render no ofrece una base de datos NoSQL tipo DynamoDB, utilizaremos el servicio real de AWS.

1. **Crear cuenta en AWS**: Si no tienes una, regístrate en [aws.amazon.com](https://aws.amazon.com/).
2. **Crear un Usuario IAM**:
   - Ve a **IAM** > **Users** > **Create user**.
   - Nombre: `urban-incidents-deploy`.
   - Permisos: Selecciona **"Attach policies directly"** y busca `AmazonDynamoDBFullAccess`.
3. **Obtener Credenciales**:
   - Una vez creado el usuario, entra en él y ve a la pestaña **Security credentials**.
   - Crea una **Access Key** (selecciona "Application running outside AWS").
   - **Guarda el Access Key ID y el Secret Access Key**. Los necesitaremos en Render.

---

## 2. Despliegue del Backend (FastAPI)

El backend se desplegará como un **Web Service** en Render.

1. **Crear Nuevo Web Service**:
   - Conecta tu repositorio de GitHub.
   - Selecciona la carpeta `backend` (o el repo raíz si están juntos).
2. **Configuración de Render**:
   - **Name**: `urban-incidents-api`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port 10000`
3. **Variables de Entorno (Environment Variables)**:
   Agrega las siguientes en la sección "Environment":
   - `AWS_ACCESS_KEY_ID`: (Tu Key de AWS)
   - `AWS_SECRET_ACCESS_KEY`: (Tu Secret de AWS)
   - `AWS_REGION`: `us-east-1` (o la que prefieras)
   - `PORT`: `10000`

> [!NOTE]
> Una vez desplegado, Render te dará una URL (ej: `https://urban-incidents-api.onrender.com`). **Cópiala**, la necesitaremos para el Frontend.

---

## 3. Despliegue del Frontend (React + Vite)

El frontend se desplegará como un **Static Site**.

### Ajuste Previo Necesario
Antes de subirlo, debemos asegurarnos de que el Frontend use la URL de Render y no `localhost`.

Modifica `frontend/src/useAuth.jsx`:
```javascript
// Cambiar esto:
const API = 'http://localhost:8080';

// Por esto:
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';
```

### Pasos en Render:
1. **Crear Nuevo Static Site**:
   - Conecta el mismo repositorio.
2. **Configuración de Render**:
   - **Name**: `urban-incidents-client`
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
3. **Variables de Entorno**:
   - `VITE_API_URL`: (La URL que copiaste del Backend de Render)

---

## 🔗 Resumen de Conexiones

| Conexión | Método | Origen | Destino |
| :--- | :--- | :--- | :--- |
| **Frontend → Backend** | Variable `VITE_API_URL` | Render Static Site | Render Web Service |
| **Backend → DB** | AWS SDK (boto3) | Render Web Service | AWS Cloud (DynamoDB) |

---

## 💡 Tips Adicionales

- **CORS**: El backend ya está configurado para aceptar peticiones de cualquier origen (`allow_origins=["*"]`), lo cual facilita la conexión inicial entre Render Client y Render API.
- **Tablas**: La aplicación está diseñada para crear las tablas automáticamente al iniciar (`create_all_tables()`). La primera vez que el backend se despliegue en Render, creará las tablas en tu cuenta de AWS.
- **Logs**: Puedes monitorear los logs en Render para verificar que la conexión con DynamoDB sea exitosa (`☁️ Conectando a AWS DynamoDB`).
