import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Rectangle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import axios from 'axios'
import 'leaflet.heat'
import './App.css'
import AuthModal from './AuthModal'
import AdminPanel from './AdminPanel'
import { useAuth, API } from './useAuth'

// ─── Configuración Geográfica (Pamplona + 30% expansión) ─────────────────────
const PAMPLONA_CENTER = [7.3758, -72.6479]
const PAMPLONA_BOUNDS = [[7.350, -72.675], [7.405, -72.620]]

const isInsidePamplona = (lat, lng) => {
  const [sw, ne] = PAMPLONA_BOUNDS
  return lat >= sw[0] && lat <= ne[0] && lng >= sw[1] && lng <= ne[1]
}

// Iconos Leaflet fix
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const getPriorityColor = p => ({ alta:'#ef4444', media:'#f59e0b', baja:'#10b981' }[p?.toLowerCase()] || '#1e3a8a')
const getCategoryEmoji = c => ({ alumbrado:'🔦',vias:'🛣️',residuos:'♻️',seguridad:'🚨',infraestructura:'🏗️',otros:'📦' }[c] || '📌')

const createCustomIcon = (cat, prio) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background:${getPriorityColor(prio)};width:38px;height:38px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;justify-content:center;align-items:center;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.2)"><span style="transform:rotate(45deg);font-size:20px">${getCategoryEmoji(cat)}</span></div>`,
  iconSize:[38,38], iconAnchor:[19,38], popupAnchor:[0,-38]
})

// ─── Componentes de Mapa ──────────────────────────────────────────────────────
function MapController({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, 17, { animate:true, duration:1.5 }) }, [center, map])
  return null
}

function MapEventsHandler({ onLocationSelect }) {
  useMapEvents({
    contextmenu(e) {
      if (!isInsidePamplona(e.latlng.lat, e.latlng.lng)) {
        alert('🚩 Ubicación fuera de los límites permitidos de Pamplona')
        return
      }
      onLocationSelect(e.latlng)
    }
  })
  return null
}

function HeatmapLayer({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points?.length) return
    const data = points
      .map(p => {
        const lat = parseFloat(p.latitud)
        const lng = parseFloat(p.longitud)
        if (isNaN(lat) || isNaN(lng)) return null
        const intensity = p.prioridad === 'alta' ? 1.0 : p.prioridad === 'media' ? 0.7 : 0.4
        return [lat, lng, intensity]
      })
      .filter(p => p !== null)

    if (!data.length) return
    const layer = L.heatLayer(data, { radius: 40, blur: 25, maxZoom: 17, minOpacity: 0.4 }).addTo(map)
    return () => map.removeLayer(layer)
  }, [map, points])
  return null
}

// ─── Formulario con Autofill ──────────────────────────────────────────────────
function FormularioIncidente({ onSubmit, isLoading, selectedLocation, setSelectedLocation, user }) {
  const [form, setForm] = useState({ calle:'', complemento:'', categoria:'alumbrado', descripcion:'', latitud:PAMPLONA_CENTER[0], longitud:PAMPLONA_CENTER[1], prioridad:'media' })
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [photos, setPhotos] = useState([]) // Array de { url, tipo }

  // Geocodificación Inversa
  const reverseGeocode = useCallback(async (lat, lng) => {
    setIsGeocoding(true)
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      if (res.data?.address) {
        const addr = res.data.address
        setForm(p => ({
          ...p,
          calle: addr.road || addr.suburb || addr.neighbourhood || '',
          complemento: `Cerca de ${addr.house_number || 'esta ubicación'}`,
          latitud: lat.toFixed(6),
          longitud: lng.toFixed(6)
        }))
      }
    } catch (e) { console.error("Error geocoding", e) }
    finally { setIsGeocoding(false) }
  }, [])

  useEffect(() => {
    if (selectedLocation) reverseGeocode(selectedLocation.lat, selectedLocation.lng)
  }, [selectedLocation, reverseGeocode])

  const handleChange = e => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
  }

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar si es muy grande (max 800px)
          const MAX_SIZE = 800;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Comprimir a JPEG con calidad 0.6
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
      };
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 3) {
      alert('Máximo 3 imágenes permitidas por reporte');
      return;
    }

    for (const file of files) {
      try {
        const compressedUrl = await compressImage(file);
        setPhotos(prev => [...prev, { 
          url: compressedUrl, 
          tipo: 'imagen', 
          fecha: new Date().toISOString(), 
          usuario_id: user.usuario_id 
        }]);
      } catch (err) {
        console.error("Error al comprimir imagen", err);
      }
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.calle || !form.descripcion) return alert('Por favor llena los campos obligatorios')
    onSubmit({ 
      ...form, 
      direccion: `${form.calle} (${form.complemento})`, 
      latitud: parseFloat(form.latitud), 
      longitud: parseFloat(form.longitud), 
      multimedia: photos,
      usuario_nombre: user.nombre 
    })
  }

  return (
    <form onSubmit={handleSubmit} className="side-form">
      <h3 className="sidebar-title">🚩 Reportar Incidente</h3>
      <div className="form-group">
        <label>Dirección *</label>
        <input name="calle" value={form.calle} onChange={handleChange} placeholder="Ej: Calle 5 # 4-20" required />
        {isGeocoding && <span className="geocoding-loader">🔍 Autocompletando dirección...</span>}
      </div>
      <div className="form-group">
        <label>Referencia</label>
        <input name="complemento" value={form.complemento} onChange={handleChange} placeholder="Ej: Frente al parque" />
      </div>
      <div className="form-group">
        <label>Categoría</label>
        <select name="categoria" value={form.categoria} onChange={handleChange}>
          <option value="alumbrado">🔦 Alumbrado Público</option>
          <option value="vias">🛣️ Daños en Vías</option>
          <option value="residuos">♻️ Residuos / Basura</option>
          <option value="seguridad">🚨 Seguridad / Emergencia</option>
          <option value="infraestructura">🏗️ Infraestructura Urbana</option>
          <option value="otros">📦 Otros</option>
        </select>
      </div>
      <div className="form-group">
        <label>Descripción *</label>
        <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows="3" placeholder="Describe lo que sucede..." required />
      </div>
      
      <div className="form-group">
        <label>Prioridad</label>
        <div className="prio-row">
          {['baja','media','alta'].map(p => (
            <button key={p} type="button" className={`prio-btn ${p} ${form.prioridad===p?'active':''}`} onClick={()=>setForm(f=>({...f, prioridad:p}))}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="photo-upload-section">
        <label>📸 Evidencias ({photos.length}/3)</label>
        <div className="photo-grid-preview">
          {photos.map((p, i) => (
            <div key={i} className="photo-thumb-container">
              <img src={p.url} alt="evidencia" className="photo-thumb" />
              <button type="button" className="btn-remove-photo" onClick={() => removePhoto(i)}>✕</button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="photo-add-placeholder">
              <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
              <span>+</span>
            </label>
          )}
        </div>
      </div>

      <button type="submit" className="btn-submit-main" disabled={isLoading || isGeocoding}>
        {isLoading ? '⏳ Enviando...' : '🚀 Enviar Reporte'}
      </button>
    </form>
  )
}

// ─── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const { user, logout, authHeader, loading } = useAuth()
  const [incidentes, setIncidentes] = useState([])
  const [filters, setFilters] = useState({ categoria: '', estado: '', prioridad: '' })
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [mapCenter, setMapCenter] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [toast, setToast] = useState({ msg: '', tipo: '' })

  useEffect(() => { cargarIncidentes() }, [])

  const cargarIncidentes = async () => {
    try {
      const res = await axios.get(`${API}/incidents/`)
      setIncidentes(res.data)
    } catch (e) { console.error("Error cargando datos", e) }
  }

  const showToast = useCallback((msg, tipo = 'success') => {
    // Si msg es un objeto o array (como los errores 422 de FastAPI), lo convertimos a string
    const message = typeof msg === 'string' ? msg : JSON.stringify(msg?.detail || msg);
    setToast({ msg: message, tipo });
    setTimeout(() => setToast({ msg: '', tipo: '' }), 5000);
  }, []);

  const handleSubmitReport = async (data) => {
    setIsLoading(true);
    try {
      // Añadimos campos obligatorios que faltaban para el modelo IncidenteCreate
      const payload = {
        ...data,
        ciudad: 'Pamplona',
        zona: 'Centro' // Por ahora estático, se podría inferir de la ubicación
      };
      
      const res = await axios.post(`${API}/incidents/`, payload, { headers: authHeader() });
      
      if (res.data.duplicados_encontrados) {
        showToast('⚠️ Incidente similar detectado cerca. Revisa el mapa.', 'error');
      } else {
        showToast('🚀 ¡Reporte enviado con éxito!');
        cargarIncidentes();
        setSelectedLocation(null);
      }
    } catch (e) {
      console.error("Error enviando reporte:", e);
      const errorMsg = e.response?.data?.detail || 'Error al conectar con el servidor';
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIncidentes = useMemo(() => {
    if (!Array.isArray(incidentes)) return []
    return incidentes.filter(inc => {
      const matchCat = !filters.categoria || inc.categoria === filters.categoria
      const matchEst = !filters.estado || inc.estado === filters.estado
      const matchPrio = !filters.prioridad || inc.prioridad === filters.prioridad
      return matchCat && matchEst && matchPrio
    })
  }, [incidentes, filters])

  if (loading) return <div className="loading-screen">🏙️ Iniciando Urban Incidents...</div>

  if (showAdmin && user && ['operador','supervisor','admin'].includes(user.rol)) {
    return <AdminPanel token={localStorage.getItem('ui_token')} userRol={user.rol} onBack={() => setShowAdmin(false)} />
  }

  return (
    <div className="app-layout">
      {toast.msg && <div className={`global-toast ${toast.tipo}`}>{toast.msg}</div>}
      
      <div className="main-map-container">
        <MapContainer 
          center={PAMPLONA_CENTER} 
          zoom={16} 
          minZoom={15} 
          maxZoom={18}
          maxBounds={PAMPLONA_BOUNDS}
          maxBoundsViscosity={1.0}
          className="map-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapController center={mapCenter} />
          <MapEventsHandler onLocationSelect={setSelectedLocation} />
          
          <Rectangle 
            bounds={PAMPLONA_BOUNDS} 
            pathOptions={{ color: 'var(--primary)', weight: 2, fillOpacity: 0.05, dashArray: '5,5' }} 
            interactive={false} 
          />

          {showHeatmap && <HeatmapLayer points={filteredIncidentes} />}
          
          {!showHeatmap && filteredIncidentes.map((inc, i) => {
            const lat = parseFloat(inc.latitud)
            const lng = parseFloat(inc.longitud)
            if (isNaN(lat) || isNaN(lng)) return null

            return (
              <Marker key={inc.incidente_id || i} position={[lat, lng]} icon={createCustomIcon(inc.categoria, inc.prioridad)}>
                <Popup className="premium-popup">
                  <div className="popup-body">
                    <span className={`prio-pill ${inc.prioridad || 'media'}`}>{inc.prioridad || 'media'}</span>
                    <h3>{getCategoryEmoji(inc.categoria)} {inc.categoria}</h3>
                    <p>📍 {inc.direccion}</p>
                    <p className="p-desc">{inc.descripcion}</p>
                    <div className="p-meta">
                      <span>👤 {inc.usuario || 'Anónimo'}</span>
                      <span>🏷️ {(inc.estado || 'reportado').replace('_',' ')}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {selectedLocation && (
            <Marker position={selectedLocation}>
              <Popup>Ubicación seleccionada para el reporte</Popup>
            </Marker>
          )}
        </MapContainer>

        <div className="floating-filters">
          <select value={filters.categoria} onChange={e => setFilters(p=>({...p, categoria: e.target.value}))}>
            <option value="">Todas las categorías</option>
            {['alumbrado','vias','residuos','seguridad','infraestructura','otros'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.estado} onChange={e => setFilters(p=>({...p, estado: e.target.value}))}>
            <option value="">Todos los estados</option>
            {['reportado','validado','en_revision','en_proceso','resuelto','rechazado'].map(e => <option key={e} value={e}>{e.replace('_',' ')}</option>)}
          </select>
          <button className={`btn-heat ${showHeatmap?'active':''}`} title="Mapa de Calor" onClick={() => setShowHeatmap(!showHeatmap)}>🔥</button>
        </div>
      </div>

      <aside className="right-sidebar">
        <header className="sidebar-header">
          <div className="sidebar-logo">🏙️ Urban Incidents <span className="tag">PAMPLONA</span></div>
          {user && (
            <div className="user-info-bar">
              <span className="user-name">👤 {user.nombre}</span>
              <button onClick={logout} className="btn-logout-small">Cerrar Sesión</button>
            </div>
          )}
        </header>

        <div className="sidebar-content scrollable">
          {user ? (
            <div className="auth-sync-container">
              {['operador','supervisor','admin'].includes(user.rol) && (
                <button className="btn-admin-access" onClick={() => setShowAdmin(true)}>🏛️ Panel de Administración</button>
              )}
              <FormularioIncidente 
                onSubmit={handleSubmitReport} 
                isLoading={isLoading} 
                selectedLocation={selectedLocation} 
                setSelectedLocation={setSelectedLocation}
                user={user} 
              />
            </div>
          ) : (
            <div className="auth-sync-container">
              <AuthModal onSuccess={() => showToast('¡Sesión iniciada correctamente!')} />
            </div>
          )}
        </div>

        <footer className="sidebar-footer">
          <p>© 2024 Pamplona - Monitoreo Urbano</p>
          <div className="system-dot">Servicio en línea</div>
        </footer>
      </aside>
    </div>
  )
}
