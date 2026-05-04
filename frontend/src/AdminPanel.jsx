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

function EstadoBadge({ estado }) {
  return (
    <span className="estado-badge" style={{ background: STATUS_COLOR[estado] || '#64748b' }}>
      {estado?.replace('_', ' ')}
    </span>
  )
}

function IncidenteDetailModal({ inc, token, onClose, onRefresh, showToast }) {
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [observacion, setObservacion] = useState('')
  const [entidad, setEntidad] = useState(inc.entidad_asignada || '')
  const [loading, setLoading] = useState(false)
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
        null, { headers, params: { entidad } })
      showToast(`✅ Asignado a "${entidad}"`)
      onRefresh(); onClose()
    } catch (e) {
      showToast('❌ Error al asignar', 'error')
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
                  <a key={i} href={m.url} target="_blank" rel="noreferrer" className="media-thumb">
                    <img src={m.url} alt={`Evidencia ${i+1}`} onError={e => e.target.style.display='none'} />
                  </a>
                ))}
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
              <label>Asignar Entidad</label>
              <div className="action-row">
                <input value={entidad} onChange={e => setEntidad(e.target.value)}
                  placeholder="Ej: Secretaría de Infraestructura" />
                <button onClick={asignar} disabled={loading} className="btn-action">
                  Asignar
                </button>
              </div>
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
