import { useState, useEffect, useCallback, memo } from 'react'
import axios from 'axios'
import { API } from './useAuth'
import './AdminPanel.css'

const ESTADOS = ['reportado','validado','en_revision','en_proceso','resuelto','cerrado','rechazado']
const CATEGORIAS = ['alumbrado','vias','residuos','seguridad','infraestructura','otros']
const PRIORIDADES = ['alta','media','baja']

const STATUS_COLOR = {
  reportado: '#f59e0b', validado: '#3b82f6', en_revision: '#8b5cf6',
  en_proceso: '#06b6d4', resuelto: '#10b981', cerrado: '#64748b', rechazado: '#ef4444'
}

const CAT_COLORS = {
  alumbrado: '#f59e0b', vias: '#3b82f6', residuos: '#10b981', 
  seguridad: '#ef4444', infraestructura: '#8b5cf6', otros: '#64748b'
}

const ENTIDADES = [
  "CENS Grupo EPM",
  "Alcaldía de Pamplona",
  "EMPOPAMPLONA S.A. E.S.P.",
  "organismos de servicio públicos"
]

function EstadoBadge({ estado }) {
  return (
    <span className="estado-badge" style={{ background: STATUS_COLOR[estado] || '#64748b' }}>
      {estado?.replace('_', ' ')}
    </span>
  )
}

function PieChart({ data }) {
  let cumulativePercent = 0
  
  const slices = data.map(slice => {
    const start = cumulativePercent
    cumulativePercent += slice.percent
    return `${slice.color} ${start}% ${cumulativePercent}%`
  }).join(', ')

  return (
    <div className="pie-wrapper">
      <div className="pie-circle" style={{ background: `conic-gradient(${slices})` }}>
        <div className="pie-hole" />
      </div>
      <div className="pie-legend">
        {data.map(slice => (
          <div key={slice.label} className="legend-item">
            <span className="legend-dot" style={{ background: slice.color }} />
            <span className="legend-label">{slice.label}</span>
            <span className="legend-pct">{slice.percent.toFixed(1)}%</span>
            <span className="legend-val">{slice.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IncidenteDetailModal({ inc, token, onClose, onRefresh, showToast }) {
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [observacion, setObservacion] = useState('')
  const [entidad, setEntidad] = useState(inc.entidad_asignada || '')
  const [isManual, setIsManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [zoomImage, setZoomImage] = useState(null)
  const headers = { Authorization: `Bearer ${token}` }

  const cambiarEstado = async () => {
    if (!nuevoEstado) return
    setLoading(true)
    try {
      await axios.put(`${API}/incidents/${inc.incidente_id}/status`,
        { 
          nuevo_estado: nuevoEstado, 
          observacion,
          ciudad_zona: inc.CiudadZona,
          fecha_id: inc.FechaID 
        }, { headers })
      showToast(`✅ Estado cambiado a "${nuevoEstado}"`)
      onRefresh(); onClose()
    } catch (e) {
      showToast(`❌ ${e.response?.data?.detail || 'Error al cambiar estado'}`, 'error')
    } finally { setLoading(false) }
  }

  const asignar = async () => {
    if (!entidad.trim()) return
    setLoading(true)
    try {
      await axios.put(`${API}/admin/incidents/${inc.incidente_id}/assign`,
        { entidad, ciudad_zona: inc.CiudadZona, fecha_id: inc.FechaID }, { headers })
      showToast(`✅ Asignado a "${entidad}"`)
      onRefresh(); onClose()
    } catch (e) {
      showToast(`❌ ${e.response?.data?.detail || 'Error al asignar'}`, 'error')
    } finally { setLoading(false) }
  }

  const eliminar = async () => {
    if (!confirm('¿Eliminar este incidente? Esta acción no se puede deshacer.')) return
    setLoading(true)
    try {
      await axios.delete(`${API}/incidents/${inc.incidente_id}`, { 
        headers,
        params: { ciudad_zona: inc.CiudadZona, fecha_id: inc.FechaID } 
      })
      showToast('🗑️ Incidente eliminado')
      onRefresh(); onClose()
    } catch (e) {
      showToast(`❌ ${e.response?.data?.detail || 'Error al eliminar'}`, 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="detail-header">
          <EstadoBadge estado={inc.estado} />
          <h3>{inc.categoria?.toUpperCase()} — {inc.direccion}</h3>
          <p className="detail-id">ID: {inc.incidente_id}</p>
        </div>

        <div className="detail-grid">
          <div className="detail-section">
            <h4>📋 Descripción</h4>
            <p>{inc.descripcion}</p>
            <div className="detail-meta">
              <span>👤 {inc.usuario}</span>
              <span>📅 {new Date(inc.fecha_creacion).toLocaleString('es-CO')}</span>
              <span>⚡ Prioridad: <strong>{inc.prioridad}</strong></span>
              <span>✅ Confirmaciones: <strong>{inc.confirmaciones || 0}</strong></span>
            </div>
            {inc.entidad_asignada && <p>🏛️ Asignado: <strong>{inc.entidad_asignada}</strong></p>}
          </div>

          {/* Evidencias multimedia */}
          {(inc.multimedia || []).length > 0 && (
            <div className="detail-section">
              <h4>📸 Evidencias</h4>
              <div className="media-grid">
                {inc.multimedia.map((m, i) => (
                  <div key={i} className="media-thumb" onClick={() => setZoomImage(m.url)}>
                    <img src={m.url} alt={`Evidencia ${i+1}`} onError={e => e.target.style.display='none'} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {zoomImage && (
            <div className="lightbox-overlay" onClick={() => setZoomImage(null)}>
              <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                <button className="lightbox-close" onClick={() => setZoomImage(null)}>✕</button>
                <img src={zoomImage} alt="Zoom" className="img-full" />
              </div>
            </div>
          )}

          {/* Historial */}
          <div className="detail-section">
            <h4>📜 Historial de Estados</h4>
            <div className="timeline">
              {(inc.historial_estados || []).map((h, i) => (
                <div key={i} className="timeline-item">
                  <div className="tl-dot" style={{ background: STATUS_COLOR[h.estado] }} />
                  <div className="tl-content">
                    <strong><EstadoBadge estado={h.estado} /></strong>
                    <span className="tl-meta">{h.usuario_nombre} · {new Date(h.fecha).toLocaleString('es-CO')}</span>
                    {h.observacion && <p className="tl-obs">{h.observacion}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="detail-section actions-section">
            <h4>⚙️ Acciones Operativas</h4>

            <div className="action-group">
              <label>Cambiar Estado</label>
              <div className="action-row">
                <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                  <option value="">Seleccionar estado...</option>
                  {ESTADOS.filter(e => e !== inc.estado).map(e => (
                    <option key={e} value={e}>{e.replace('_',' ')}</option>
                  ))}
                </select>
                <button onClick={cambiarEstado} disabled={!nuevoEstado || loading} className="btn-action">
                  Cambiar
                </button>
              </div>
              <textarea
                value={observacion} onChange={e => setObservacion(e.target.value)}
                placeholder="Observación (opcional)..." rows={2}
              />
            </div>

            <div className="action-group">
              <label>Asignar Entidad Responsable</label>
              <div className="action-row">
                <select 
                  value={isManual ? 'otros' : entidad} 
                  onChange={e => {
                    if (e.target.value === 'otros') {
                      setIsManual(true)
                      setEntidad('')
                    } else {
                      setIsManual(false)
                      setEntidad(e.target.value)
                    }
                  }}
                >
                  <option value="">Seleccionar entidad...</option>
                  {ENTIDADES.map(ent => (
                    <option key={ent} value={ent}>{ent}</option>
                  ))}
                  <option value="otros">Otra (Manual)</option>
                </select>
                <button onClick={asignar} disabled={!entidad || loading} className="btn-action">
                  Asignar
                </button>
              </div>
              {isManual && (
                <input 
                  placeholder="Escribe la entidad..." 
                  value={entidad}
                  onChange={e => setEntidad(e.target.value)}
                  style={{marginTop:'8px'}}
                  autoFocus
                />
              )}
            </div>

            <button onClick={eliminar} disabled={loading} className="btn-danger">
              🗑️ Eliminar Reporte
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPanel({ token, userRol, onBack }) {
  const [incidentes, setIncidentes] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('incidentes') // 'incidentes' | 'audit'
  const [toast, setToast] = useState({ msg: '', tipo: '' })
  const [filters, setFilters] = useState({ estado: '', categoria: '', prioridad: '' })

  const headers = { Authorization: `Bearer ${token}` }

  const showToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast({ msg: '', tipo: '' }), 4000)
  }

  const fetchIncidentes = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.estado) params.estado = filters.estado
      if (filters.categoria) params.categoria = filters.categoria
      if (filters.prioridad) params.prioridad = filters.prioridad
      const res = await axios.get(`${API}/admin/incidents`, { headers, params })
      setIncidentes(res.data)
    } catch (e) { showToast('❌ Error al cargar incidentes', 'error') }
    finally { setLoading(false) }
  }, [filters, token])

  const fetchAudit = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/audit`, { headers })
      setAuditLog(res.data)
    } catch { }
  }, [token])

  useEffect(() => { fetchIncidentes() }, [fetchIncidentes])
  useEffect(() => { if (view === 'audit') fetchAudit() }, [view, fetchAudit])

  const prioColor = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' }

  return (
    <div className="admin-shell">
      {toast.msg && <div className={`admin-toast ${toast.tipo}`}>{toast.msg}</div>}

      <header className="admin-header">
        <div className="admin-logo">
          <button className="btn-back-map" onClick={onBack}>⬅ Mapa</button>
          🏛️ Panel Administrativo <span className="admin-tag">{userRol}</span>
        </div>
        <nav className="admin-nav">
          <button className={view === 'incidentes' ? 'active' : ''} onClick={() => setView('incidentes')}>
            📋 Incidentes
          </button>
          {['supervisor','admin'].includes(userRol) && (
            <button className={view === 'audit' ? 'active' : ''} onClick={() => setView('audit')}>
              🔍 Auditoría
            </button>
          )}
          {userRol === 'admin' && (
            <button className={view === 'reportes' ? 'active' : ''} onClick={() => setView('reportes')}>
              📊 Reportes
            </button>
          )}
        </nav>
      </header>

      <div className="admin-body">
        {view === 'incidentes' && (
          <>
            {/* Filtros */}
            <div className="admin-filters">
              <select value={filters.estado} onChange={e => setFilters(p => ({...p, estado: e.target.value}))}>
                <option value="">Todos los estados</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_',' ')}</option>)}
              </select>
              <select value={filters.categoria} onChange={e => setFilters(p => ({...p, categoria: e.target.value}))}>
                <option value="">Todas las categorías</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filters.prioridad} onChange={e => setFilters(p => ({...p, prioridad: e.target.value}))}>
                <option value="">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button className="btn-filter" onClick={fetchIncidentes}>🔄 Actualizar</button>
              <span className="admin-count">{incidentes.length} registros</span>
            </div>

            {/* Tabla */}
            {loading ? (
              <div className="admin-loading">Cargando datos...</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Estado</th>
                      <th>Categoría</th>
                      <th>Dirección</th>
                      <th>Evidencia</th>
                      <th>Prioridad</th>
                      <th>Confirmaciones</th>
                      <th>Fecha</th>
                      <th>Reportante</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidentes.map((inc, i) => (
                      <tr key={inc.incidente_id || i} onClick={() => setSelected(inc)} className="table-row">
                        <td><EstadoBadge estado={inc.estado} /></td>
                        <td><span className="cat-chip">{inc.categoria}</span></td>
                        <td className="addr-cell">{inc.direccion}</td>
                        <td className="evidence-cell">
                          <div className="admin-thumb-list">
                            {(inc.multimedia || []).slice(0, 3).map((m, idx) => (
                              <img key={idx} src={m.url} alt="thumb" className="admin-mini-thumb" />
                            ))}
                            {(!inc.multimedia || inc.multimedia.length === 0) && <span className="no-media">Sin foto</span>}
                          </div>
                        </td>
                        <td>
                          <span className="prio-dot" style={{ background: prioColor[inc.prioridad] }} />
                          {inc.prioridad}
                        </td>
                        <td className="center">✅ {inc.confirmaciones || 0}</td>
                        <td className="date-cell">{new Date(inc.fecha_creacion).toLocaleDateString('es-CO')}</td>
                        <td>{inc.usuario}</td>
                        <td>
                          <button className="btn-detail" onClick={e => { e.stopPropagation(); setSelected(inc) }}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {incidentes.length === 0 && <div className="no-results">No hay incidentes con los filtros seleccionados.</div>}
              </div>
            )}
          </>
        )}

        {view === 'audit' && (
          <div className="audit-view">
            <h3>🔍 Registro de Auditoría</h3>
            <div className="audit-list">
              {auditLog.map((log, i) => (
                <div key={i} className="audit-item">
                  <div className="audit-action">{log.accion}</div>
                  <div className="audit-info">
                    <span>👤 {log.usuario_nombre}</span>
                    <span>🎯 {log.entidad_id?.slice(0,8)}...</span>
                    <span>📅 {new Date(log.timestamp).toLocaleString('es-CO')}</span>
                  </div>
                  {Object.keys(log.detalle || {}).length > 0 && (
                    <pre className="audit-detail">{JSON.stringify(log.detalle, null, 2)}</pre>
                  )}
                </div>
              ))}
              {auditLog.length === 0 && <p className="no-results">No hay registros de auditoría.</p>}
            </div>
          </div>
        )}

        {view === 'reportes' && (
          <div className="reports-view">
            <h3>📊 Resumen Estadístico de Incidentes</h3>
            
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Reportes</span>
                <span className="stat-value">{incidentes.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Resueltos</span>
                <span className="stat-value">{incidentes.filter(i => i.estado === 'resuelto').length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">En Proceso</span>
                <span className="stat-value">{incidentes.filter(i => i.estado === 'en_proceso').length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Pendientes</span>
                <span className="stat-value">{incidentes.filter(i => i.estado === 'reportado').length}</span>
              </div>
            </div>

            <div className="charts-container">
              <div className="chart-box">
                <h4>Distribución por Categoría</h4>
                <PieChart data={CATEGORIAS.map(cat => ({
                  label: cat,
                  count: incidentes.filter(i => i.categoria === cat).length,
                  percent: incidentes.length ? (incidentes.filter(i => i.categoria === cat).length / incidentes.length * 100) : 0,
                  color: CAT_COLORS[cat]
                })).filter(s => s.count > 0)} />
              </div>

              <div className="chart-box">
                <h4>Distribución por Estado</h4>
                <div className="classic-bar-chart">
                  <div className="y-axis">
                    {[5,4,3,2,1,0].map(n => (
                      <div key={n} className="y-mark"><span>{n}</span></div>
                    ))}
                  </div>
                  <div className="chart-area">
                    <div className="bars-container">
                      {ESTADOS.map(est => {
                        const count = incidentes.filter(i => i.estado === est).length;
                        const max = Math.max(...ESTADOS.map(e => incidentes.filter(i => i.estado === e).length), 5);
                        const height = (count / max * 100);
                        return (
                          <div key={est} className="bar-v-col">
                            <div className="bar-v-track">
                              <div className="bar-v-fill" style={{ height: `${height}%`, background: STATUS_COLOR[est] }}>
                                <div className="bar-v-tooltip">{count}</div>
                              </div>
                            </div>
                            <div className="bar-v-label-bot">{est.replace('_',' ')}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <IncidenteDetailModal
          inc={selected}
          token={token}
          onClose={() => setSelected(null)}
          onRefresh={fetchIncidentes}
          showToast={showToast}
        />
      )}
    </div>
  )
}
