import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, money, pad, soloDigitos, WHATSAPP } from '../lib/supabase'
import { optimizarImagen } from '../lib/imagen'

export default function Home() {
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
      const { data: d } = await supabase.from('dinamicas').select('*')
        .eq('estado', 'activa').order('created_at', { ascending: false }).limit(1).maybeSingle()
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
  }, [])

  if (cargando) return <div className="center pad"><div className="spinner" /> Cargando dinámicas…</div>
  if (!din) return (
    <section className="hero">
      <h1 className="display">Próximamente</h1>
      <p>No hay dinámicas activas en este momento. Síguenos en Instagram para enterarte de la próxima.</p>
    </section>
  )

  const raw = prog?.meta ? (prog.vendidos / prog.meta) * 100 : 0
  const pct = Math.min(100, raw)
  const pctTxt = raw > 0 && raw < 10 ? raw.toFixed(1) : Math.round(pct)

  return (
    <>
      <section className="hero">
        {din.imagen_url && <img className="hero-img" src={din.imagen_url} alt={din.titulo} />}
        <p className="eyebrow">Dinámica activa</p>
        <h1 className="display">{din.titulo}</h1>
        {din.descripcion && <p className="lead">{din.descripcion}</p>}
        <div className="hero-meta">
          <span>{money(din.precio_numero)} <small>por número</small></span>
          {din.fecha_sorteo && <span>Sorteo: {new Date(din.fecha_sorteo).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
        </div>
        <div className="progress"><div style={{ width: (pct > 0 ? Math.max(pct, 2) : 0) + '%' }} /></div>
        <p className="muted small">{pctTxt}% vendido</p>
      </section>

      {cantidad == null ? (
        <section className="section">
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
      setError(err.message || 'No se pudo completar la compra.')
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    const nums = (resultado.numeros || []).map((n) => pad(n, din.total_numeros))
    return (
      <section className="section card exito">
        <h2 className="title">¡Compra recibida!</h2>
        <span className="badge">Pendiente de validación</span>
        <p className="muted">Tus números asignados</p>
        <div className="nums">{nums.map((n) => <span key={n}>{n}</span>)}</div>
        <button className="btn ghost" onClick={() => copiar(nums.join(', '), 'nums')}>{copiado === 'nums' ? '¡Copiados!' : 'Copiar mis números'}</button>
        <div className="aviso">
          <strong>No enviamos números por WhatsApp.</strong>
          <p>En un máximo de 24 horas validamos tu pago. Luego entra al Verificador con tu teléfono para ver tus números aprobados.</p>
        </div>
        <Link className="btn block" to="/verificador">Ir al Verificador</Link>
      </section>
    )
  }

  return (
    <section className="section">
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

        <label>Método de pago *
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {metodos.map((x) => <option key={x.id} value={x.id}>{x.banco}{x.tipo_cuenta ? ` · ${x.tipo_cuenta}` : ''}</option>)}
          </select>
        </label>

        {m && (
          <div className="cuenta">
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
