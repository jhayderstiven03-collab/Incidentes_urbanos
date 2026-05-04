import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Rectangle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import 'leaflet.heat'
import './App.css'

// --- Constantes Pamplona Urbana ---
const PAMPLONA_CENTER = [7.3758, -72.6479]
const PAMPLONA_BOUNDS = [
  [7.358, -72.668], // Suroeste ampliado (~30% más de cobertura)
  [7.394, -72.628]  // Noreste ampliado
]

const isInsidePamplona = (lat, lng) => {
  const [sw, ne] = PAMPLONA_BOUNDS
  return lat >= sw[0] && lat <= ne[0] && lng >= sw[1] && lng <= ne[1]
}

// Fix icono leaflet default
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const API = 'http://localhost:8080'

// --- Utilidades de Diseño ---
const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'alta': return '#ef4444' // Rojo moderado
    case 'media': return '#f59e0b' // Ámbar/Naranja
    case 'baja': return '#10b981' // Verde suave
    default: return '#1e3a8a' // Azul profundo
  }
}

const getCategoryEmoji = (categoria) => {
  const emojis = {
    alumbrado: '🔦',
    vias: '🛣️',
    residuos: '♻️',
    seguridad: '🚨',
    infraestructura: '🏗️',
    otros: '📦'
  }
  return emojis[categoria] || '📌'
}

const createCustomIcon = (categoria, prioridad) => {
  const color = getPriorityColor(prioridad)
  const emoji = getCategoryEmoji(categoria)
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        justify-content: center;
        align-items: center;
        border: 3px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 20px;
        ">${emoji}</span>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
  })
}

// --- Componentes de Mapa ---

function MapController({ center, zoom = 15 }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, {
        animate: true,
        duration: 1.5
      })
    }
  }, [center, zoom, map])
  return null
}

function MapEventsHandler({ onLocationSelect }) {
  const map = useMapEvents({
    contextmenu(e) {
      if (!isInsidePamplona(e.latlng.lat, e.latlng.lng)) {
        alert('🚩 Ubicación fuera de Pamplona. Por favor selecciona un punto dentro de la ciudad.')
        return
      }
      onLocationSelect(e.latlng)
    }
  })
  return null
}

function MapResizeObserver({ isStatsOpen }) {
  const map = useMap()
  useEffect(() => {
    // Forzar redibujado cuando el panel lateral abre/cierra o al montar
    setTimeout(() => {
      map.invalidateSize()
    }, 400)
  }, [map, isStatsOpen])
  return null
}

function HeatmapLayer({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points || points.length === 0) return
    
    // Filtrado de seguridad: solo procesar puntos con coordenadas válidas
    const heatData = points
      .filter(p => p.latitud && p.longitud && !isNaN(parseFloat(p.latitud)) && !isNaN(parseFloat(p.longitud)))
      .map(p => [
        parseFloat(p.latitud), 
        parseFloat(p.longitud), 
        p.prioridad === 'alta' ? 1.0 : p.prioridad === 'media' ? 0.7 : 0.4
      ])

    if (heatData.length === 0) return

    const heatLayer = L.heatLayer(heatData, {
      radius: 40,      
      blur: 25,        
      maxZoom: 17,
      minOpacity: 0.4,
      gradient: { 0.4: '#3b82f6', 0.6: '#10b981', 0.8: '#f59e0b', 1.0: '#ef4444' }
    }).addTo(map)

    return () => {
      if (map && heatLayer) {
        map.removeLayer(heatLayer)
      }
    }
  }, [map, points])
  return null
}

// --- Componentes de Formulario ---

function FormularioIncidente({ onSubmit, isLoading, selectedLocation, setSelectedLocation, setMapCenter }) {
  // Memoizamos el estado inicial
  const initialState = useMemo(() => ({
    calle: '',
    complemento: '',
    categoria: 'alumbrado',
    descripcion: '',
    latitud: PAMPLONA_CENTER[0],
    longitud: PAMPLONA_CENTER[1],
    prioridad: 'media',
    usuario: '',
  }), [])

  const [form, setForm] = useState(initialState)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [errors, setErrors] = useState({})

  // Limpiar formulario tras envío exitoso
  useEffect(() => {
    if (!isLoading && form.descripcion === '' && !selectedLocation) {
       // Ya está limpio
    }
  }, [isLoading, selectedLocation])

  // Geocodificación Inversa
  const performReverseGeocode = useCallback(async (lat, lng) => {
    setIsGeocoding(true)
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      if (res.data && res.data.address) {
        const addr = res.data.address
        const street = addr.road || addr.suburb || addr.neighbourhood || ''
        const city = addr.city || addr.town || addr.village || ''
        setForm(prev => ({ 
          ...prev, 
          calle: street,
          complemento: `En ${city}`,
          latitud: lat.toFixed(6),
          longitud: lng.toFixed(6)
        }))
      }
    } catch (e) {
      console.error('Error geocoding', e)
    } finally {
      setIsGeocoding(false)
    }
  }, [])

  // Geocodificación Directa
  const performForwardGeocode = useCallback(async (street) => {
    if (!street || street.length < 4) return
    setIsGeocoding(true)
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${street}, Pamplona, Colombia&limit=1`)
      if (res.data && res.data[0]) {
        const { lat, lon } = res.data[0]
        const nLat = parseFloat(lat), nLng = parseFloat(lon)
        if (isInsidePamplona(nLat, nLng)) {
          setSelectedLocation({ lat: nLat, lng: nLng })
          setMapCenter([nLat, nLng]) // Solo centramos cuando se busca una dirección específica
        }
      }
    } catch (e) {
      console.error('Error geocoding', e)
    } finally {
      setIsGeocoding(false)
    }
  }, [setSelectedLocation, setMapCenter])

  useEffect(() => {
    if (selectedLocation) {
      performReverseGeocode(selectedLocation.lat, selectedLocation.lng)
    }
  }, [selectedLocation, performReverseGeocode])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords
        if (isInsidePamplona(latitude, longitude)) {
          setSelectedLocation({ lat: latitude, lng: longitude })
          setMapCenter([latitude, longitude]) // Aquí sí centramos intencionalmente
        } else {
          alert('📍 Tu ubicación actual está fuera de los límites de Pamplona.')
        }
      })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!form.calle.trim()) newErrors.calle = 'Indica la calle o carrera'
    if (!form.descripcion.trim()) newErrors.descripcion = 'Describe el incidente'
    if (!form.usuario.trim()) newErrors.usuario = 'Indica tu nombre'
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const fullAddress = `${form.calle} (${form.complemento})`
    onSubmit({
      ...form,
      ciudad: 'Pamplona',
      zona: 'Urbana',
      direccion: fullAddress,
      latitud: parseFloat(form.latitud),
      longitud: parseFloat(form.longitud)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="formulario modern-form">
      <div className="location-action-bar">
        <button type="button" className="btn-location" onClick={handleUseCurrentLocation}>
          📍 Localizarme ahora
        </button>
      </div>

      <div className="form-section">
        <label>Ubicación del Incidente</label>
        <div className="form-row">
          <div className="form-group flex-2">
            <label className="sub-label">Calle / Carrera / Avenida *</label>
            <input name="calle" value={form.calle} onChange={handleChange} onBlur={() => performForwardGeocode(form.calle)} placeholder="Ej: Carrera 4 # 5-20" className={errors.calle ? 'input-error' : ''} />
            {errors.calle && <span className="error-text">{errors.calle}</span>}
          </div>
          <div className="form-group flex-1">
            <label className="sub-label">Referencia (Opcional)</label>
            <input name="complemento" value={form.complemento} onChange={handleChange} placeholder="Ej: Frente al parque" />
          </div>
        </div>

        {/* Coordenadas ocultas pero mantenidas en el estado para la lógica interna */}
        <p className="map-hint">🖱️ <strong>Clic derecho</strong> en el mapa para marcar la ubicación exacta en Pamplona.</p>
      </div>

      <div className="form-section">
        <label>Detalles del Reporte</label>
        <div className="form-group">
          <label className="sub-label">Tipo de Incidente *</label>
          <select name="categoria" value={form.categoria} onChange={handleChange}>
            <option value="alumbrado">🔦 Alumbrado público</option>
            <option value="vias">🛣️ Daños en vías</option>
            <option value="residuos">♻️ Acumulación de residuos</option>
            <option value="seguridad">🚨 Seguridad</option>
            <option value="infraestructura">🏗️ Infraestructura</option>
            <option value="otros">📦 Otros</option>
          </select>
        </div>

        <div className="form-group">
          <label className="sub-label">Descripción del problema *</label>
          <textarea name="descripcion" value={form.descripcion} onChange={handleChange} placeholder="Describe detalladamente lo que sucede..." className={errors.descripcion ? 'input-error' : ''} rows={4} />
          {errors.descripcion && <span className="error-text">{errors.descripcion}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="sub-label">Prioridad *</label>
          <select name="prioridad" value={form.prioridad} onChange={handleChange} className={`prio-select ${form.prioridad}`}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div className="form-group">
          <label className="sub-label">Reportado por *</label>
          <input name="usuario" value={form.usuario} onChange={handleChange} placeholder="Tu nombre completo" className={errors.usuario ? 'input-error' : ''} />
          {errors.usuario && <span className="error-text">{errors.usuario}</span>}
        </div>
      </div>

      <button type="submit" className="btn-submit" disabled={isLoading || isGeocoding}>
        {isLoading ? '⏳ Enviando...' : isGeocoding ? '🔍 Verificando...' : '📤 Enviar Reporte Oficial'}
      </button>
    </form>
  )
}

// --- Dashboard & Lista ---

const AnalyticsDashboard = memo(({ analytics, onClose }) => {
  if (!analytics) return <div className="loading-spinner">Cargando datos...</div>
  
  const categoryData = useMemo(() => 
    Object.entries(analytics.categories || {}).map(([name, value]) => ({ name, value }))
  , [analytics.categories])

  const priorityData = useMemo(() => 
    Object.entries(analytics.priorities || {}).map(([name, value]) => ({ name, value }))
  , [analytics.priorities])

  const COLORS = ['#2563eb', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b']

  return (
    <div className="analytics-panel">
      <div className="panel-header">
        <div className="header-title">
          <h3>Métricas Urbanas</h3>
          <p>Estado actual de la ciudad</p>
        </div>
        <button className="btn-close-panel" onClick={onClose} title="Cerrar">✕</button>
      </div>
      
      <div className="panel-content scrollable">
        {/* Resumen Principal */}
        <div className="metrics-grid">
          <div className="ana-card highlight">
            <span className="ana-val">{analytics.total}</span>
            <span className="ana-lbl">Total Reportes</span>
          </div>
          <div className="metrics-row">
            <div className="ana-card border-warning">
              <span className="ana-val small yellow">{analytics.pending}</span>
              <span className="ana-lbl">Pendientes</span>
            </div>
            <div className="ana-card border-success">
              <span className="ana-val small green">{analytics.solved}</span>
              <span className="ana-lbl">Resueltos</span>
            </div>
          </div>
        </div>

        {/* Gráficos Modulares */}
        <div className="ana-card chart-card">
          <h4>Distribución por Categoría</h4>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                {categoryData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip borderRadius={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="ana-card chart-card">
          <h4>Nivel de Prioridad</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={25}>
                {priorityData.map((e, i) => <Cell key={i} fill={getPriorityColor(e.name)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
})

const IncidentesRecientes = memo(({ incidentes }) => {
  if (incidentes.length === 0) return <div className="no-data">No hay reportes recientes en Pamplona.</div>
  return (
    <div className="recent-list">
      {incidentes.map((inc, i) => (
        <div key={inc.id || i} className={`incident-card-mini prio-${inc.prioridad}`}>
          <div className="mini-header">
            <span className="mini-cat">{getCategoryEmoji(inc.categoria)} {inc.categoria}</span>
            <span className="mini-status">{inc.estado}</span>
          </div>
          <p className="mini-addr">📍 {inc.direccion}</p>
          <p className="mini-desc">{inc.descripcion}</p>
          <div className="mini-footer">
            <span>{inc.usuario}</span>
            <span className="prio-label">{inc.prioridad.toUpperCase()}</span>
          </div>
        </div>
      ))}
    </div>
  )
})

// --- App Principal ---

export default function App() {
  const [incidentes, setIncidentes] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })
  const [mapCenter, setMapCenter] = useState(null) 
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [resInc, resAna] = await Promise.all([
        axios.get(`${API}/incidents/`),
        axios.get(`${API}/analytics/summary`)
      ])
      const pamplonaOnly = resInc.data.filter(i => isInsidePamplona(parseFloat(i.latitud), parseFloat(i.longitud)))
      setIncidentes(pamplonaOnly)
      setAnalytics(resAna.data)
    } catch (e) {
      console.error('Error fetching data', e)
    }
  }

  const mostrarMensaje = useCallback((texto, tipo = 'success') => {
    setMensaje({ texto, tipo })
    setTimeout(() => setMensaje({ texto: '', tipo: '' }), 4000)
  }, [])

  const handleSubmit = async (data) => {
    setIsLoading(true)
    try {
      await axios.post(`${API}/incidents/`, data)
      mostrarMensaje('🚀 Incidente reportado correctamente. ¡Gracias por tu aporte!')
      cargarDatos()
      setSelectedLocation(null)
    } catch (e) {
      mostrarMensaje('❌ No se pudo enviar el reporte. Verifica tu conexión.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCenterMap = useCallback(() => {
    setMapCenter(PAMPLONA_CENTER)
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-section">
            <h1>🏘️ Urban Incidents <span className="tag">Pamplona</span></h1>
            <p>Monitoreo ciudadano y transparencia urbana</p>
          </div>
          <nav className="header-nav">
             {/* Navegación simplificada para mayor limpieza */}
             <div className="header-status">
               <span className="dot online"></span> Sistema Activo
             </div>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {mensaje.texto && (
          <div className={`global-toast ${mensaje.tipo}`}>
            {mensaje.texto}
          </div>
        )}

        <div className="map-view-container">
          <aside className="sidebar">
            <div className="sidebar-card scrollable">
              <h2 className="section-title">📝 Reportar Incidente</h2>
              <FormularioIncidente 
                onSubmit={handleSubmit} 
                isLoading={isLoading} 
                selectedLocation={selectedLocation} 
                setSelectedLocation={setSelectedLocation}
                setMapCenter={setMapCenter}
              />
            </div>
            <div className="sidebar-card">
              <h2 className="section-title">📜 Actividad Local</h2>
              <IncidentesRecientes incidentes={incidentes.slice(0, 4)} />
            </div>
          </aside>

          <section className="map-area">
            {/* MÓDULO DE CONTROL MODERNO */}
            <div className="map-header">
              <div className="map-controls-modern">
                <button className={`control-btn ${showHeatmap ? 'active' : ''}`} onClick={() => setShowHeatmap(!showHeatmap)} title="Alternar Mapa de Calor">
                   🔥 <span className="lbl">Mapa de Calor</span>
                </button>
                <div className="divider-v"></div>
                <button className="control-btn" onClick={handleCenterMap} title="Centrar Mapa">
                   🎯 <span className="lbl">Centrar</span>
                </button>
                <button className={`control-btn main ${isStatsOpen ? 'active' : ''}`} onClick={() => setIsStatsOpen(!isStatsOpen)} title="Análisis de Datos">
                   📊 <span className="lbl">Estadísticas</span>
                </button>
              </div>
            </div>
            
            <div className="map-canvas">
              <MapContainer 
                center={PAMPLONA_CENTER} 
                zoom={16} 
                minZoom={15}
                maxZoom={18}
                maxBounds={PAMPLONA_BOUNDS} 
                maxBoundsViscosity={1.0}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                <MapController center={mapCenter} zoom={17} />
                <MapResizeObserver isStatsOpen={isStatsOpen} />
                <MapEventsHandler onLocationSelect={setSelectedLocation} />
                
                <Rectangle 
                  bounds={PAMPLONA_BOUNDS} 
                  pathOptions={{ color: 'var(--primary)', weight: 2, fillOpacity: 0.02, dashArray: '5, 5' }} 
                  interactive={false}
                />

                {showHeatmap && <HeatmapLayer points={incidentes} />}
                
                {!showHeatmap && incidentes.map((inc, i) => (
                  inc.latitud && inc.longitud && (
                    <Marker key={inc.id || i} position={[parseFloat(inc.latitud), parseFloat(inc.longitud)]} icon={createCustomIcon(inc.categoria, inc.prioridad)}>
                      <Popup className="premium-popup">
                        <div className="popup-body">
                          <span className={`prio-pill ${inc.prioridad}`}>{inc.prioridad}</span>
                          <h3>{getCategoryEmoji(inc.categoria)} {inc.categoria}</h3>
                          <p className="p-addr">📍 {inc.direccion}</p>
                          <p className="p-desc">{inc.descripcion}</p>
                          <div className="p-meta">
                            <span>👤 {inc.usuario}</span>
                            <span className="p-status">{inc.estado}</span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                ))}

                {selectedLocation && (
                  <Marker position={selectedLocation} icon={L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })}>
                    <Popup>Punto seleccionado</Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
            
            {/* Drawer de Estadísticas Lateral */}
            {isStatsOpen && <div className="drawer-overlay" onClick={() => setIsStatsOpen(false)}></div>}
            <div className={`side-panel-container ${isStatsOpen ? 'open' : ''}`}>
              <AnalyticsDashboard analytics={analytics} onClose={() => setIsStatsOpen(false)} />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
