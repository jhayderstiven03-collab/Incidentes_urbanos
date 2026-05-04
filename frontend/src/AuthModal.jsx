import { useState } from 'react'
import { useAuth } from './useAuth'
import './AuthModal.css'

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ nombre: '', email: '', password: '', telefono: '', direccion: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (mode === 'register') {
      if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
      if (!/^\d{7,15}$/.test(form.telefono)) return setError('Formato de teléfono inválido')
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const user = await login(form.email, form.password)
        onSuccess(user)
      } else {
        await register(form.nombre, form.email, form.password, form.telefono, form.direccion)
        const user = await login(form.email, form.password)
        onSuccess(user)
      }
    } catch (err) {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg) || 'Error al procesar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-form-container">
      <div className="auth-logo">🏙️ Urban Incidents</div>
      <h2>{mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
      <p className="auth-sub">
        {mode === 'login' ? 'Accede para reportar y confirmar incidentes' : 'Únete a la comunidad de Pamplona'}
      </p>

      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <>
            <div className="auth-field">
              <label>Nombre completo *</label>
              <input name="nombre" value={form.nombre} onChange={handle} placeholder="Tu nombre" required />
            </div>
            <div className="auth-field">
              <label>Teléfono *</label>
              <input name="telefono" type="tel" value={form.telefono} onChange={handle} placeholder="Ej: 3101234567" required />
            </div>
            <div className="auth-field">
              <label>Dirección de residencia *</label>
              <input name="direccion" value={form.direccion} onChange={handle} placeholder="Carrera 4 # 5-10" required />
            </div>
          </>
        )}
        <div className="auth-field">
          <label>Correo electrónico *</label>
          <input name="email" type="email" value={form.email} onChange={handle} placeholder="email@ejemplo.com" required />
        </div>
        <div className="auth-field">
          <label>Contraseña *</label>
          <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" required />
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? '⏳ Procesando...' : mode === 'login' ? '🔐 Entrar' : '🚀 Registrarme'}
        </button>
      </form>

      <div className="auth-switch">
        {mode === 'login' ? (
          <span>¿No tienes cuenta? <button onClick={() => setMode('register')}>Regístrate</button></span>
        ) : (
          <span>¿Ya tienes cuenta? <button onClick={() => setMode('login')}>Inicia sesión</button></span>
        )}
      </div>
    </div>
  )
}
