import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, money, pad, soloDigitos, WHATSAPP } from '../lib/supabase'
import { optimizarImagen } from '../lib/imagen'
import Tambor from '../components/Tambor'

export default function Rifa() {
  const { id } = useParams()
  const [din, setDin] = useState(null)
  const [paquetes, setPaquetes] = useState([])
  const [metodos, setMetodos] = useState([])
  const [disp, setDisp] = useState(null)
  const [prog, setProg] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cantidad, setCantidad] = useState(null)
  const [custom, setCustom] = useState(false)

  useEffect(() => {
    ;(async () => {
      const esUuid = /^[0-9a-f-]{36}$/i.test(id)
      const { data: d } = await supabase.from('dinamicas').select('*')
        .eq(esUuid ? 'id' : 'slug', id).eq('estado', 'activa').maybeSingle()
      setDin(d)
      if (d) {
        const [{ data: p }, { data: m }, { data: n }] = await Promise.all([
          supabase.from('paquetes').select('*').eq('dinamica_id', d.id).order('orden'),
          supabase.from('metodos_pago').select('*').eq('activo', true).order('orden'),
          supabase.rpc('progreso', { p_dinamica: d.id }),
        ])
        setPaquetes(p || []); setMetodos(m || []); setProg(n); setDisp(n?.disponibles ?? null)
      }
      setCargando(false)
    })()
  }, [id])

  if (cargando) return (
    <>
      <section className="hero">
        <div className="sk sk-hero-img" />
        <div className="sk sk-hero-t" />
        <div className="sk sk-hero-l" />
      </section>
      <section className="section">
        <div className="paquetes">{[0, 1, 2, 3].map((i) => <div key={i} className="paquete sk sk-paq" />)}</div>
      </section>
    </>
  )
  if (!din) return (
    <section className="hero">
      <h1 className="display sm-light">Esta rifa no está disponible</h1>
      <p>Puede que ya haya cerrado o que el enlace no sea correcto.</p>
      <Link className="btn light" to="/">Ver rifas activas</Link>
    </section>
  )

  const raw = prog?.meta ? (prog.vendidos / prog.meta) * 100 : 0
  const pct = Math.min(100, raw)
  const pctTxt = raw > 0 && raw < 10 ? raw.toFixed(1) : Math.round(pct)

  return (
    <>
      <section className="hero">
        <Link className="volver" to="/">← Todas las rifas</Link>
        {din.imagen_url && <img className="hero-img" src={din.imagen_url} alt={din.titulo} />}
        <h1 className="display">{din.titulo}</h1>
        {din.descripcion && <p className="lead">{din.descripcion}</p>}
        <div className="hero-meta">
          <span>{money(din.precio_numero)} <small>por número</small></span>
          {din.fecha_sorteo && <span>Sorteo: {new Date(din.fecha_sorteo).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
        </div>
        <div className="progress"><div className="llenar" style={{ '--w': (pct > 0 ? Math.max(pct, 2) : 0) + '%' }} /></div>
        <p className="muted small">{pctTxt}% vendido</p>
      </section>

      {cantidad == null ? (
        <section className="section entra" key="paquetes">
          <h2 className="title">Elige tu paquete de números</h2>
          <p className="muted center">A mayor cantidad, más oportunidades de ganar</p>
          <div className="paquetes">
            {paquetes.map((p) => (
              <button key={p.id} className={'paquete' + (p.etiqueta ? ' destacado' : '')} onClick={() => setCantidad(p.cantidad)}>
                {p.etiqueta && <span className="tag">{p.etiqueta}</span>}
                <span className="p-nombre">{p.nombre}</span>
                <span className="p-cant">{p.cantidad}</span>
                <span className="p-lbl">números</span>
                <span className="p-precio">{money(p.cantidad * din.precio_numero)}</span>
              </button>
            ))}
          </div>
          <div className="or">o</div>
          {custom ? (
            <CantidadCustom min={din.min_compra} max={disp} precio={din.precio_numero} onOk={setCantidad} />
          ) : (
            <button className="btn ghost block" onClick={() => setCustom(true)}>Elegir cantidad personalizada</button>
          )}
          <p className="muted small center">Mínimo {din.min_compra} números</p>
        </section>
      ) : (
        <Checkout din={din} metodos={metodos} cantidad={cantidad} setCantidad={setCantidad} />
      )}
    </>
  )
}

function CantidadCustom({ min, max, precio, onOk }) {
  const [v, setV] = useState(min)
  const ok = v >= min && (max == null || v <= max)
  return (
    <div className="custom">
      <div className="stepper">
        <button onClick={() => setV(Math.max(min, v - 1))}>−</button>
        <input type="number" value={v} min={min} onChange={(e) => setV(parseInt(e.target.value) || 0)} />
        <button onClick={() => setV(v + 1)}>+</button>
      </div>
      <p className="center">{money(v * precio)}</p>
      <button className="btn block" disabled={!ok} onClick={() => onOk(v)}>Continuar</button>
    </div>
  )
}

function Checkout({ din, metodos, cantidad, setCantidad }) {
  const [nombre, setNombre] = useState('')
  const [tel, setTel] = useState('')
  const [metodo, setMetodo] = useState(metodos[0]?.id || '')
  const [file, setFile] = useState(null)
  const [ref, setRef] = useState('')
  const [acepto, setAcepto] = useState(false)
  const [honey, setHoney] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)
  const [copiado, setCopiado] = useState('')

  const total = cantidad * din.precio_numero
  const m = metodos.find((x) => x.id === metodo)
  const telOk = soloDigitos(tel).length === 10
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  const copiar = async (txt, key) => {
    try { await navigator.clipboard.writeText(txt); setCopiado(key); setTimeout(() => setCopiado(''), 1500) } catch {}
  }

  const onFile = (f) => {
    setError('')
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setError('El comprobante debe ser JPG, PNG o WEBP.')
    if (f.size > 20 * 1024 * 1024) return setError('El comprobante pesa más de 20MB.')
    setFile(f)
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (honey) return
    setError('')
    if (nombre.trim().split(/\s+/).length < 2) return setError('Escribe tu nombre y apellido.')
    if (!telOk) return setError('Tu número está incompleto. Escríbelo con sus 10 dígitos, ej. 829 555 5555.')
    if (!metodo) return setError('Selecciona un método de pago.')
    if (!file) return setError('Sube el comprobante de pago.')
    if (!acepto) return setError('Debes aceptar los términos para continuar.')

    setEnviando(true)
    try {
      let subir = file
      try { subir = (await optimizarImagen(file, { maxLado: 1800, calidad: 0.85 })).file } catch { /* usa el original */ }
      const ext = subir.type === 'image/webp' ? 'webp' : file.name.split('.').pop().toLowerCase()
      const path = `${din.id}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('comprobantes').upload(path, subir, { contentType: subir.type })
      if (up.error) throw up.error
      const { data, error } = await supabase.rpc('crear_compra', {
        p_dinamica: din.id, p_nombre: nombre, p_telefono: soloDigitos(tel), p_cantidad: cantidad,
        p_metodo: metodo, p_comprobante: path, p_referencia: ref || null,
      })
      if (error) throw error
      setResultado(data)
    } catch (err) {
      setError(mensajeCompra(err))
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    const nums = (resultado.numeros || []).map((n) => pad(n, din.total_numeros))
    return (
      <section className="section card exito entra">
        <h2 className="title">¡Compra recibida!</h2>
        <span className="badge">Reservados · pendiente de validación</span>
        <p className="reserva-txt">Estos son tus <strong>{nums.length} números</strong>. Quedan <strong>reservados a tu nombre</strong> mientras validamos tu pago; nadie más los puede tomar.</p>
        {nums.length <= 10 ? (
          <div className="tambores">{(resultado.numeros || []).map((n, i) => <Tambor key={n} valor={n} tam="chico" retraso={i * 260} />)}</div>
        ) : (
          <div className="nums reservados">{nums.map((n) => <span key={n}>{n}</span>)}</div>
        )}
        <button className="btn ghost" onClick={() => copiar(nums.join(', '), 'nums')}>{copiado === 'nums' ? '¡Copiados!' : 'Copiar mis números'}</button>
        <div className="aviso">
          <strong>No enviamos números por WhatsApp.</strong>
          <p>Guarda o copia tus números. En un máximo de 24 horas validamos tu pago y quedan confirmados. Puedes verlos en cualquier momento en el Verificador con tu teléfono. Si el pago no se puede validar, la reserva se cancela.</p>
        </div>
        <Link className="btn block" to="/verificador">Ir al Verificador</Link>
      </section>
    )
  }

  return (
    <section className="section entra" key="checkout">
      <form className="card checkout" onSubmit={enviar}>
        <button type="button" className="back" onClick={() => setCantidad(null)}>← Cambiar paquete</button>
        <h2 className="title">Completa tu compra</h2>

        <div className="resumen">
          <span>{cantidad} números</span>
          <strong>{money(total)}</strong>
        </div>
        <p className="muted small">Los números se asignan al azar. Quedan pendientes hasta validar tu pago.</p>

        <input className="hp" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} placeholder="No rellenar" />

        <label>Nombre completo *
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
        </label>

        <label>Teléfono (WhatsApp) *
          <input inputMode="numeric" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="829 555 5555" />
          <small className={tel && !telOk ? 'err' : 'muted'}>
            {tel && !telOk ? 'Escribe los 10 dígitos.' : 'Con este número verás tus números en el Verificador.'}
          </small>
        </label>

        <div className="campo">¿A qué banco vas a transferir? *
          <div className="bancos" role="radiogroup">
            {metodos.map((x) => (
              <button type="button" key={x.id} role="radio" aria-checked={x.id === metodo}
                className={'banco' + (x.id === metodo ? ' activo' : '')} onClick={() => setMetodo(x.id)}>
                <LogoBanco m={x} />
                <span className="banco-nom">{x.banco}</span>
                {x.tipo_cuenta && <span className="banco-tipo">{x.tipo_cuenta}</span>}
              </button>
            ))}
          </div>
        </div>

        {m && (
          <div className="cuenta entra" key={m.id}>
            <div className="cuenta-top"><LogoBanco m={m} /><div><strong>{m.banco}</strong><div className="muted small">{m.tipo_cuenta}</div></div></div>
            <div><span className="muted small">Número de cuenta</span>
              <div className="row"><strong className="mono">{m.numero_cuenta}</strong>
                <button type="button" className="chip" onClick={() => copiar(m.numero_cuenta, 'cta')}>{copiado === 'cta' ? 'Copiado' : 'Copiar'}</button></div></div>
            <div><span className="muted small">Titular</span><div>{m.titular}{m.cedula_rnc ? ` · ${m.cedula_rnc}` : ''}</div></div>
            <p className="small">Transfiere <strong>{money(total)}</strong> y sube el comprobante.</p>
          </div>
        )}

        <label className="upload">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files[0])} />
          {preview ? <img src={preview} alt="Comprobante" /> : <span>Toca para subir tu comprobante<br /><small>JPG, PNG o WEBP</small></span>}
        </label>

        <label>Referencia de la transferencia (opcional)
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Agiliza la validación" />
        </label>

        <label className="check">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>Acepto los <Link to="/terminos" target="_blank">Términos y Condiciones</Link> y confirmo que mis datos son correctos.</span>
        </label>

        {error && <div className="error">{error} <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">Escríbenos por WhatsApp</a></div>}

        <div className="total"><span>Total a pagar</span><strong>{money(total)}</strong></div>
        <button className="btn block" disabled={enviando}>{enviando ? 'Enviando…' : 'Confirmar compra'}</button>
        <p className="muted small center">Tu compra será validada en máximo 24 horas.</p>
      </form>
    </section>
  )
}

export function LogoBanco({ m, chico }) {
  return (
    <span className={'banco-logo' + (chico ? ' chico' : '')}>
      {m?.logo_url ? <img src={m.logo_url} alt="" /> : <span>{(m?.banco || '?').trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}

// Solo mostramos al cliente mensajes pensados para él, nunca errores internos.
function mensajeCompra(err) {
  const m = String(err?.message || '')
  if (m.includes('Compra mínima')) return m.replace(/\.$/, '') + '.'
  if (m.includes('No quedan suficientes')) return 'No quedan suficientes números disponibles en esta rifa. Prueba con una cantidad menor.'
  if (m.includes('no disponible')) return 'Esta rifa ya no está disponible.'
  return 'No se pudo completar la compra. Revisa tu conexión e intenta de nuevo.'
}
