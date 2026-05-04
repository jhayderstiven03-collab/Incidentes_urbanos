import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

const getPriorityColor = p => ({ alta:'#ef4444', media:'#f59e0b', baja:'#10b981' }[p?.toLowerCase()] || '#3b82f6')
const getCategoryEmoji = c => ({ alumbrado:'🔦',vias:'🛣️',residuos:'♻️',seguridad:'🚨',infraestructura:'🏗️',otros:'📦' }[c] || '📌')

const createCustomIcon = (cat, prio) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background:${getPriorityColor(prio)};width:38px;height:38px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;justify-content:center;align-items:center;border:3px solid white;box-shadow:0 8px 15px rgba(0,0,0,0.3)"><span style="transform:rotate(45deg);font-size:20px">${getCategoryEmoji(cat)}</span></div>`,
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
    const layer = L.heatLayer(data, { radius: 45, blur: 25, maxZoom: 17, minOpacity: 0.5 }).addTo(map)
    return () => map.removeLayer(layer)
  }, [map, points])
  return null
}

function CameraModal({ onCapture, onClose }) {
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        setStream(s)
        if (videoRef.current) videoRef.current.srcObject = s
      } catch (err) {
        alert("Error al acceder a la cámara: " + err.message)
        onClose()
      }
    }
    startCamera()
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [onClose])

  const handleCapture = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.7))
    onClose()
  }

  return (
    <div className="camera-overlay">
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="camera-controls">
          <button type="button" className="btn-capture" onClick={handleCapture}>📸 Capturar</button>
          <button type="button" className="btn-close-cam" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Formulario con Autofill ──────────────────────────────────────────────────
function FormularioIncidente({ onSubmit, isLoading, selectedLocation, setSelectedLocation, setMapCenter, user }) {
  const [form, setForm] = useState({ calle:'', complemento:'', categoria:'alumbrado', descripcion:'', latitud:PAMPLONA_CENTER[0], longitud:PAMPLONA_CENTER[1], prioridad:'media' })
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [photos, setPhotos] = useState([])
  const [showCamera, setShowCamera] = useState(false)

  const reverseGeocode = useCallback(async (lat, lng, centerMap = false) => {
    setIsGeocoding(true)
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      if (res.data?.address) {
        const addr = res.data.address
        setForm(p => ({
          ...p,
          calle: addr.road || addr.suburb || addr.neighbourhood || '',
          complemento: addr.house_number ? `Frente al número ${addr.house_number}` : 'Cerca de esta ubicación',
          latitud: lat.toFixed(6),
          longitud: lng.toFixed(6)
        }))
        if (centerMap) {
          setSelectedLocation({ lat, lng })
          setMapCenter([lat, lng])
        }
      }
    } catch (e) { console.error("Error geocoding", e) }
    finally { setIsGeocoding(false) }
  }, [setSelectedLocation, setMapCenter])

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta geolocalización")
    setIsGeocoding(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        if (!isInsidePamplona(latitude, longitude)) {
          setIsGeocoding(false)
          return alert("Tu ubicación actual está fuera de los límites de Pamplona.")
        }
        reverseGeocode(latitude, longitude, true)
      },
      (err) => {
        setIsGeocoding(false)
        alert("Error al obtener ubicación: " + err.message)
      },
      { enableHighAccuracy: true }
    )
  }

  useEffect(() => {
    if (selectedLocation) {
      reverseGeocode(selectedLocation.lat, selectedLocation.lng);
      // Auto-scroll to form on mobile when location is selected
      if (window.innerWidth <= 768) {
        document.querySelector('.right-sidebar')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
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
          const MAX_SIZE = 800;
          if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
          else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 3) return alert('Máximo 3 imágenes')
    for (const file of files) {
      try {
        const compressedUrl = await compressImage(file);
        setPhotos(prev => [...prev, { url: compressedUrl, tipo: 'imagen', fecha: new Date().toISOString(), usuario_id: user.usuario_id }]);
      } catch (err) { console.error(err) }
    }
  };

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.calle || !form.descripcion) return
    const dirFinal = form.complemento ? `${form.calle} (${form.complemento})` : form.calle
    onSubmit({ 
      ...form, 
      direccion: dirFinal, 
      latitud: parseFloat(form.latitud), 
      longitud: parseFloat(form.longitud), 
      multimedia: photos,
      usuario_nombre: user.nombre 
    })
  }

  return (
    <form onSubmit={handleSubmit} className="side-form">
      <h3 className="sidebar-title">🏙️ Nuevo Reporte</h3>
      <div className="form-group">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <label>Ubicación Detectada</label>
          <button type="button" className="btn-use-location" onClick={handleUseMyLocation} disabled={isGeocoding}>
            📍 Usar mi ubicación
          </button>
        </div>
        <input name="calle" value={form.calle} onChange={handleChange} placeholder="Calle / Carrera..." required />
        <input name="complemento" value={form.complemento} onChange={handleChange} placeholder="Referencia (ej: Frente al D1)..." />
        {isGeocoding && <span className="geocoding-loader">📍 Procesando ubicación...</span>}
      </div>
      <div className="form-group">
        <label>Categoría del Incidente</label>
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
        <label>¿Qué está sucediendo?</label>
        <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows="3" placeholder="Detalles importantes..." required />
      </div>
      
      <div className="form-group">
        <label>Nivel de Urgencia</label>
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
              <button type="button" className="btn-remove-photo" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
          {photos.length < 3 && (
            <>
              <button type="button" className="photo-add-placeholder cam" onClick={() => setShowCamera(true)}>
                <span style={{fontSize:'12px',fontWeight:800}}>CÁMARA</span>
              </button>
              <label className="photo-add-placeholder">
                <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{display:'none'}} />
                <span>+</span>
              </label>
            </>
          )}
        </div>
      </div>

      {showCamera && (
        <CameraModal 
          onCapture={(url) => setPhotos(p => [...p, { url, tipo: 'imagen', fecha: new Date().toISOString(), usuario_id: user.usuario_id }])} 
          onClose={() => setShowCamera(false)} 
        />
      )}

      <button type="submit" className="btn-submit-main" disabled={isLoading || isGeocoding}>
        {isLoading ? '⏳ Enviando...' : '🚀 Publicar Reporte'}
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
    } catch (e) { console.error(e) }
  }

  const showToast = useCallback((msg, tipo = 'success') => {
    const message = typeof msg === 'string' ? msg : (msg?.detail || 'Error');
    setToast({ msg: message, tipo });
    setTimeout(() => setToast({ msg: '', tipo: '' }), 4000);
  }, []);

  const handleSubmitReport = async (data) => {
    setIsLoading(true);
    try {
      const payload = { ...data, ciudad: 'Pamplona', zona: 'Centro' };
      const res = await axios.post(`${API}/incidents/`, payload, { headers: authHeader() });
      
      if (res.data.duplicados_encontrados) {
        showToast('⚠️ Incidente similar detectado.', 'error');
      } else {
        showToast('✅ ¡Reporte publicado con éxito!');
        cargarIncidentes();
        setSelectedLocation(null);
      }
    } catch (e) {
      showToast(e.response?.data?.detail || 'Error de conexión', 'error');
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

  if (loading) return <div className="loading-screen">🏙️ Urban Incidents</div>

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
          className="map-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapController center={mapCenter} />
          <MapEventsHandler onLocationSelect={setSelectedLocation} />
          
          <Rectangle bounds={PAMPLONA_BOUNDS} pathOptions={{ color: '#3b82f6', weight: 2, fillOpacity: 0.05, dashArray: '8,8' }} />

          {showHeatmap && <HeatmapLayer points={filteredIncidentes} />}
          
          {!showHeatmap && filteredIncidentes.map((inc, i) => (
            <Marker key={inc.incidente_id || i} position={[parseFloat(inc.latitud), parseFloat(inc.longitud)]} icon={createCustomIcon(inc.categoria, inc.prioridad)}>
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
          ))}

          {selectedLocation && <Marker position={selectedLocation}><Popup>Nueva ubicación</Popup></Marker>}
        </MapContainer>

        <div className="floating-filters">
          <select value={filters.categoria} onChange={e => setFilters(p=>({...p, categoria: e.target.value}))}>
            <option value="">Categorías</option>
            {['alumbrado','vias','residuos','seguridad','infraestructura','otros'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.estado} onChange={e => setFilters(p=>({...p, estado: e.target.value}))}>
            <option value="">Estados</option>
            {['reportado','validado','en_revision','en_proceso','resuelto','rechazado'].map(e => <option key={e} value={e}>{e.replace('_',' ')}</option>)}
          </select>
          <button className={`btn-heat ${showHeatmap?'active':''}`} onClick={() => setShowHeatmap(!showHeatmap)}>🔥</button>
        </div>
      </div>

      <aside className="right-sidebar">
        <header className="sidebar-header">
          <div className="sidebar-logo">🏙️ Urban Incidents <span className="tag">PAMPLONA</span></div>
          {user && (
            <div className="user-info-bar">
              <span className="user-name">👤 {user.nombre}</span>
              <button onClick={logout} className="btn-logout-small">Salir</button>
            </div>
          )}
        </header>

        <div className="sidebar-content scrollable">
          {user ? (
            <>
              {['operador','supervisor','admin'].includes(user.rol) && (
                <button className="btn-admin-access" onClick={() => setShowAdmin(true)}>🏛️ Panel de Control</button>
              )}
              <FormularioIncidente 
                onSubmit={handleSubmitReport} 
                isLoading={isLoading} 
                selectedLocation={selectedLocation} 
                setSelectedLocation={setSelectedLocation} 
                setMapCenter={setMapCenter}
                user={user} 
              />
            </>
          ) : (
            <AuthModal onSuccess={() => showToast('¡Bienvenido!')} />
          )}
        </div>

        <footer className="sidebar-footer">
          <p>© 2024 Pamplona Digital</p>
        </footer>
      </aside>
    </div>
  )
}
