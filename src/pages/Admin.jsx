import { useEffect, useState, useCallback } from 'react'
import { supabase, money, pad } from '../lib/supabase'
import { optimizarImagen } from '../lib/imagen'
import { LogoBanco } from './Rifa'

export default function Admin() {
  const [session, setSession] = useState(null)
  const [esAdmin, setEsAdmin] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setEsAdmin(null)
    supabase.rpc('es_admin').then(({ data }) => setEsAdmin(!!data))
  }, [session])

  if (!session) return <Login />
  if (esAdmin === null) return <div className="center pad"><div className="spinner" /></div>
  if (!esAdmin) return (
    <div className="admin-wrap center pad">
      <p>Esta cuenta no tiene permisos de administrador.</p>
      <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Salir</button>
    </div>
  )
  return <Panel />
}

function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const entrar = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) setError(/confirm/i.test(error.message) ? 'Esta cuenta aún no está confirmada.' : 'Correo o contraseña incorrectos.')
  }
  return (
    <div className="admin-wrap section narrow">
      <h1 className="display sm">Panel</h1>
      <form className="card" onSubmit={entrar}>
        <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Contraseña<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn block">Entrar</button>
      </form>
    </div>
  )
}

function Panel() {
  const [tab, setTab] = useState('compras')
  return (
    <div className="admin-wrap">
      <header className="nav">
        <span className="brand"><span className="brand-name">NASHLA´S</span><span className="brand-sub">PANEL</span></span>
        <nav>
          {['compras', 'ganador', 'dinamicas', 'cuentas'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </nav>
      </header>
      <main className="section wide">
        {tab === 'compras' && <Compras />}
        {tab === 'ganador' && <Ganador />}
        {tab === 'dinamicas' && <Dinamicas />}
        {tab === 'cuentas' && <Cuentas />}
      </main>
    </div>
  )
}

/* ---------- Compras ---------- */
function Compras() {
  const [estado, setEstado] = useState('pendiente')
  const [lista, setLista] = useState([])
  const [stats, setStats] = useState({})
  const [ver, setVer] = useState(null)
  const [q, setQ] = useState('')
  const [rifa, setRifa] = useState('')
  const [resumen, setResumen] = useState([])

  const cargar = useCallback(async () => {
    let query = supabase.from('compras')
      .select('*, dinamicas(titulo,total_numeros), metodos_pago(banco,logo_url), numeros(numero)')
      .eq('estado', estado).order('created_at', { ascending: estado === 'pendiente' }).limit(200)
    if (rifa) query = query.eq('dinamica_id', rifa)
    if (q) query = query.or(`telefono.ilike.%${q}%,nombre.ilike.%${q}%`)
    const { data } = await query
    setLista(data || [])
    let qa = supabase.from('compras').select('estado,total')
    if (rifa) qa = qa.eq('dinamica_id', rifa)
    const { data: all } = await qa
    const s = { pendiente: 0, aprobada: 0, rechazada: 0, recaudado: 0 }
    ;(all || []).forEach((c) => { s[c.estado]++; if (c.estado === 'aprobada') s.recaudado += Number(c.total) })
    setStats(s)
    const { data: r } = await supabase.rpc('resumen_ventas')
    setResumen(r || [])
  }, [estado, q, rifa])

  useEffect(() => { cargar() }, [cargar])

  const abrir = async (c) => {
    const { data } = await supabase.storage.from('comprobantes').createSignedUrl(c.comprobante_path, 600)
    setVer({ ...c, url: data?.signedUrl })
  }

  const validar = async (c, aprobar) => {
    let motivo = null
    if (!aprobar) { motivo = prompt('Motivo del rechazo (opcional):') ; if (motivo === null) return }
    const { error } = await supabase.rpc('validar_compra', { p_compra: c.id, p_aprobar: aprobar, p_motivo: motivo })
    if (error) return alert('No se pudo guardar. Intenta de nuevo.')
    setVer(null); cargar()
  }

  return (
    <>
      <div className="toolbar">
        <h3>Resumen</h3>
        <select className="sel-rifa" value={rifa} onChange={(e) => setRifa(e.target.value)}>
          <option value="">Todas las rifas</option>
          {resumen.map((r) => <option key={r.id} value={r.id}>{r.titulo} ({r.estado})</option>)}
        </select>
      </div>
      <div className="stats">
        <div><span>Pendientes</span><strong>{stats.pendiente ?? '—'}</strong></div>
        <div><span>Aprobadas</span><strong>{stats.aprobada ?? '—'}</strong></div>
        <div><span>Rechazadas</span><strong>{stats.rechazada ?? '—'}</strong></div>
        <div><span>Recaudado</span><strong>{money(stats.recaudado)}</strong></div>
      </div>
      <VentasPorRifa resumen={rifa ? resumen.filter((r) => r.id === rifa) : resumen} />

      <div className="toolbar">
        <div className="seg">
          {['pendiente', 'aprobada', 'rechazada'].map((e) => (
            <button key={e} className={estado === e ? 'active' : ''} onClick={() => setEstado(e)}>{e}s</button>
          ))}
        </div>
        <input placeholder="Buscar nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="tabla">
        {lista.length === 0 && <p className="muted center pad">Sin compras {estado}s.</p>}
        {lista.map((c) => (
          <div className="fila" key={c.id} onClick={() => abrir(c)}>
            <div><strong>{c.nombre}</strong><br /><span className="muted small banco-inline"><LogoBanco m={c.metodos_pago} chico />{c.telefono} · {c.metodos_pago?.banco}</span></div>
            <div className="small">{c.dinamicas?.titulo}<br /><span className="muted">{new Date(c.created_at).toLocaleString('es-DO')}</span></div>
            <div className="right"><strong>{money(c.total)}</strong><br /><span className="muted small">{c.cantidad} números</span></div>
          </div>
        ))}
      </div>

      {ver && (
        <div className="modal" onClick={() => setVer(null)}>
          <div className="card modal-body" onClick={(e) => e.stopPropagation()}>
            <h3>{ver.nombre}</h3>
            <p className="small muted banco-inline"><LogoBanco m={ver.metodos_pago} chico />{ver.telefono} · {ver.metodos_pago?.banco} · Ref: {ver.referencia || '—'}</p>
            <p><strong>{money(ver.total)}</strong> · {ver.cantidad} números</p>
            {ver.url ? <a href={ver.url} target="_blank" rel="noreferrer"><img className="comprobante" src={ver.url} alt="Comprobante" /></a> : <p className="muted">Comprobante no disponible</p>}
            {ver.numeros?.length > 0 && <div className="nums small">{ver.numeros.map((n) => <span key={n.numero}>{pad(n.numero, ver.dinamicas?.total_numeros || 10000)}</span>)}</div>}
            {ver.motivo_rechazo && <p className="error">Motivo: {ver.motivo_rechazo}</p>}
            <div className="row gap">
              {ver.estado === 'pendiente' && <>
                <button className="btn" onClick={() => validar(ver, true)}>Aprobar</button>
                <button className="btn danger" onClick={() => validar(ver, false)}>Rechazar</button>
              </>}
              <a className="btn ghost" href={`https://wa.me/1${ver.telefono}`} target="_blank" rel="noreferrer">WhatsApp</a>
              <button className="btn ghost" onClick={() => setVer(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- Ventas por rifa ---------- */
function VentasPorRifa({ resumen }) {
  if (!resumen.length) return null
  const n = (x) => Number(x || 0).toLocaleString('es-DO')
  return (
    <div className="tabla ventas">
      <div className="v-fila v-head">
        <span>Rifa</span><span>Vendidos</span><span>Pendientes</span><span>Disponibles</span><span>Meta</span><span>Recaudado</span>
      </div>
      {resumen.map((r) => {
        const pct = r.meta ? Math.min(100, (r.vendidos / r.meta) * 100) : 0
        return (
          <div className="v-fila" key={r.id}>
            <span><strong>{r.titulo}</strong><br /><span className={'badge ' + (r.estado === 'activa' ? 'ok' : '')}>{r.estado}</span></span>
            <span data-l="Vendidos"><strong>{n(r.vendidos)}</strong></span>
            <span data-l="Pendientes">{n(r.pendientes)}</span>
            <span data-l="Disponibles">{n(r.disponibles)}</span>
            <span data-l="Meta">
              <span className="mini-bar"><span style={{ width: pct + '%' }} /></span>
              <small>{pct > 0 && pct < 10 ? pct.toFixed(1) : Math.round(pct)}% de {n(r.meta)}</small>
            </span>
            <span data-l="Recaudado"><strong>{money(r.recaudado)}</strong></span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Buscar ganador ---------- */
function Ganador() {
  const [dinamicas, setDinamicas] = useState([])
  const [din, setDin] = useState('')
  const [num, setNum] = useState('')
  const [res, setRes] = useState(null)
  const [img, setImg] = useState(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    supabase.from('dinamicas').select('id,titulo,total_numeros,estado,numero_ganador,fuente_resultado')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setDinamicas(data || []); if (data?.[0]) setDin(data[0].id) })
  }, [])

  const d = dinamicas.find((x) => x.id === din)

  const buscar = async (e) => {
    e?.preventDefault()
    const n = parseInt(num.replace(/\D/g, ''), 10)
    if (!din || isNaN(n)) return
    setCargando(true); setRes(null); setImg(null)
    const { data } = await supabase.from('numeros')
      .select('numero, compras(id,nombre,telefono,estado,cantidad,total,referencia,created_at,validada_at,comprobante_path,metodos_pago(banco,logo_url))')
      .eq('dinamica_id', din).eq('numero', n).maybeSingle()
    setCargando(false)
    setRes({ numero: n, compra: data?.compras || null })
    if (data?.compras?.comprobante_path) {
      const { data: u } = await supabase.storage.from('comprobantes').createSignedUrl(data.compras.comprobante_path, 600)
      setImg(u?.signedUrl)
    }
  }

  const confirmar = async () => {
    if (!confirm(`¿Registrar ${pad(res.numero, d.total_numeros)} como número ganador de "${d.titulo}"? La dinámica pasará a "sorteada".`)) return
    const { error } = await supabase.from('dinamicas')
      .update({ numero_ganador: res.numero, estado: 'sorteada', fecha_resultado: new Date().toISOString().slice(0, 10) }).eq('id', din)
    if (error) return alert('No se pudo guardar. Intenta de nuevo.')
    setDinamicas(dinamicas.map((x) => x.id === din ? { ...x, numero_ganador: res.numero, estado: 'sorteada' } : x))
    alert('Ganador registrado.')
  }

  const c = res?.compra
  const msg = c && encodeURIComponent(`¡Hola ${c.nombre.split(' ')[0]}! Te escribimos de Nashla´s Shop 🎉 Tu número ${pad(res.numero, d.total_numeros)} resultó GANADOR en "${d.titulo}". Contáctanos para coordinar la entrega de tu premio.`)

  return (
    <>
      <form className="card" onSubmit={buscar}>
        <h3>Buscar ganador</h3>
        <div className="grid2">
          <label>Dinámica
            <select value={din} onChange={(e) => { setDin(e.target.value); setRes(null) }}>
              {dinamicas.map((x) => <option key={x.id} value={x.id}>{x.titulo} ({x.estado})</option>)}
            </select>
          </label>
          <label>Número ganador {d?.fuente_resultado && <small className="muted">· {d.fuente_resultado}</small>}
            <input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Ej. 0427" />
          </label>
        </div>
        <button className="btn" disabled={cargando}>{cargando ? 'Buscando…' : 'Buscar'}</button>
        {d?.numero_ganador != null && <p className="small muted">Ganador registrado: <strong>{pad(d.numero_ganador, d.total_numeros)}</strong></p>}
      </form>

      {res && (
        <div className="card">
          <div className="numero-ganador center">{pad(res.numero, d.total_numeros)}</div>
          {!c ? (
            <p className="center">Este número <strong>no fue vendido</strong>.</p>
          ) : (
            <>
              {c.estado !== 'aprobada' && <div className="error">Ojo: esta compra está <strong>{c.estado}</strong>. Valídala antes de declarar ganador.</div>}
              <div className="grid2 detalle">
                <div><span className="muted small">Nombre</span><p><strong>{c.nombre}</strong></p></div>
                <div><span className="muted small">Teléfono</span><p className="mono">{c.telefono}</p></div>
                <div><span className="muted small">Compra</span><p>{c.cantidad} números · {money(c.total)}</p></div>
                <div><span className="muted small">Pago</span><p>{c.metodos_pago?.banco} · Ref: {c.referencia || '—'}</p></div>
                <div><span className="muted small">Fecha de compra</span><p>{new Date(c.created_at).toLocaleString('es-DO')}</p></div>
                <div><span className="muted small">Estado</span><p><span className={'badge ' + (c.estado === 'aprobada' ? 'ok' : '')}>{c.estado}</span></p></div>
              </div>
              {img && <a href={img} target="_blank" rel="noreferrer"><img className="comprobante" src={img} alt="Comprobante" /></a>}
              <div className="row gap">
                {c.estado === 'aprobada' && d.numero_ganador !== res.numero && <button className="btn" onClick={confirmar}>Registrar como ganador</button>}
                <a className="btn ghost" href={`https://wa.me/1${c.telefono}?text=${msg}`} target="_blank" rel="noreferrer">Avisar por WhatsApp</a>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

/* ---------- Imagen del premio ---------- */
function ImagenPremio({ value, onChange }) {
  const [subiendo, setSubiendo] = useState(false)
  const [info, setInfo] = useState('')
  const [modoUrl, setModoUrl] = useState(false)

  const subir = async (f) => {
    if (!f) return
    setSubiendo(true); setInfo('Subiendo…')
    try {
      const r = await optimizarImagen(f, { maxLado: 1600, calidad: 0.82 })
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.webp`
      const { error } = await supabase.storage.from('premios').upload(path, r.file, { contentType: 'image/webp', cacheControl: '31536000' })
      if (error) throw error
      const { data } = supabase.storage.from('premios').getPublicUrl(path)
      onChange(data.publicUrl)
      setInfo('Imagen lista.')
    } catch (e) {
      setInfo('No se pudo subir la imagen. Intenta de nuevo.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="img-premio">
      <span className="lbl">Imagen del premio</span>
      {value && <img src={value} alt="Premio" />}
      <div className="row gap">
        <label className="btn ghost file-btn">
          {subiendo ? 'Procesando…' : value ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/*" disabled={subiendo} onChange={(e) => subir(e.target.files[0])} />
        </label>
        <button type="button" className="chip" onClick={() => setModoUrl(!modoUrl)}>{modoUrl ? 'Ocultar URL' : 'Usar URL'}</button>
        {value && <button type="button" className="chip" onClick={() => { onChange(''); setInfo('') }}>Quitar</button>}
      </div>
      {modoUrl && <input placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} />}
      {info && <small className="muted">{info}</small>}
    </div>
  )
}

/* ---------- Dinámicas ---------- */
const PAQUETES_BASE = [
  { nombre: 'BRONCE', cantidad: 2 }, { nombre: 'PLATA', cantidad: 5 },
  { nombre: 'ORO', cantidad: 10, etiqueta: 'POPULAR' }, { nombre: 'PLATINO', cantidad: 15 },
  { nombre: 'DIAMANTE', cantidad: 25, etiqueta: 'VIP' }, { nombre: 'ÉLITE', cantidad: 50 },
  { nombre: 'LEYENDA', cantidad: 100, etiqueta: 'MÁXIMO' },
]

function Dinamicas() {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)

  const cargar = async () => {
    const { data } = await supabase.from('dinamicas').select('*, paquetes(*)').order('created_at', { ascending: false })
    setLista(data || [])
  }
  useEffect(() => { cargar() }, [])

  const nuevo = () => setForm({ titulo: '', descripcion: '', imagen_url: '', precio_numero: 50, total_numeros: 10000, min_compra: 2, fecha_sorteo: '', estado: 'borrador', fuente_resultado: 'Pick 4 New York · Noche', paquetes: PAQUETES_BASE })

  const guardar = async (e) => {
    e.preventDefault()
    const { paquetes, id, created_at, numero_ganador, slug, ...d } = form
    d.fecha_sorteo = d.fecha_sorteo || null
    let dinId = id
    if (id) {
      const { error } = await supabase.from('dinamicas').update(d).eq('id', id)
      if (error) return alert('No se pudo guardar. Intenta de nuevo.')
      await supabase.from('paquetes').delete().eq('dinamica_id', id)
    } else {
      const { data, error } = await supabase.from('dinamicas').insert(d).select().single()
      if (error) return alert('No se pudo guardar. Intenta de nuevo.')
      dinId = data.id
    }
    const rows = paquetes.filter((p) => p.cantidad > 0).map((p, i) => ({ dinamica_id: dinId, nombre: p.nombre, cantidad: +p.cantidad, etiqueta: p.etiqueta || null, orden: i }))
    if (rows.length) await supabase.from('paquetes').insert(rows)
    setForm(null); cargar()
  }

  const ganador = async (d) => {
    const n = prompt(`Número ganador según ${d.fuente_resultado || 'el resultado oficial'}:`)
    if (n === null || n === '') return
    await supabase.from('dinamicas').update({ numero_ganador: parseInt(n), estado: 'sorteada', fecha_resultado: new Date().toISOString().slice(0, 10) }).eq('id', d.id)
    const { data } = await supabase.from('numeros').select('compras(nombre,telefono,estado)').eq('dinamica_id', d.id).eq('numero', parseInt(n)).maybeSingle()
    alert(data?.compras ? `Ganador: ${data.compras.nombre} · ${data.compras.telefono} (${data.compras.estado})` : 'Ese número no fue vendido.')
    cargar()
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (form) return (
    <form className="card" onSubmit={guardar}>
      <h3>{form.id ? 'Editar' : 'Nueva'} dinámica</h3>
      <div className="grid2">
        <label>Título<input required value={form.titulo} onChange={set('titulo')} /></label>
        <label>Estado<select value={form.estado} onChange={set('estado')}>
          {['borrador', 'activa', 'cerrada', 'sorteada'].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Precio por número (RD$)<input type="number" step="0.01" required value={form.precio_numero} onChange={set('precio_numero')} /></label>
        <label>Total de números<input type="number" required value={form.total_numeros} onChange={set('total_numeros')} disabled={!!form.id} /></label>
        <label>Meta de venta (barra de progreso)
          <input type="number" min="1" placeholder="Ej. 2000" value={form.meta_numeros ?? ''} onChange={(e) => setForm({ ...form, meta_numeros: e.target.value === '' ? null : parseInt(e.target.value) })} />
          <small className="muted">Cantidad de números que quieres vender. La barra de progreso se llena según esta meta.</small>
        </label>
        <label className="check"><input type="checkbox" checked={form.contar_pendientes ?? true} onChange={(e) => setForm({ ...form, contar_pendientes: e.target.checked })} /> Contar compras pendientes en la barra</label>
        <label>Compra mínima<input type="number" required value={form.min_compra} onChange={set('min_compra')} /></label>
        <label>Fecha del sorteo<input type="datetime-local" value={form.fecha_sorteo?.slice(0, 16) || ''} onChange={set('fecha_sorteo')} /></label>
      </div>
      <label>Fuente del resultado
        <select value={form.fuente_resultado || ''} onChange={set('fuente_resultado')}>
          <option value="">— Seleccionar —</option>
          <option>Pick 4 New York · Noche</option>
          <option>Pick 5 Florida · Noche</option>
          <option>Lotería Nacional (RD)</option>
          <option>Sorteo en vivo por Instagram</option>
        </select>
      </label>
      <ImagenPremio value={form.imagen_url || ''} onChange={(url) => setForm({ ...form, imagen_url: url })} />
      <label>Descripción<textarea rows={3} value={form.descripcion || ''} onChange={set('descripcion')} /></label>

      <h4>Paquetes</h4>
      {form.paquetes.map((p, i) => (
        <div className="row gap" key={i}>
          <input value={p.nombre} onChange={(e) => { const ps = [...form.paquetes]; ps[i] = { ...p, nombre: e.target.value }; setForm({ ...form, paquetes: ps }) }} />
          <input type="number" value={p.cantidad} onChange={(e) => { const ps = [...form.paquetes]; ps[i] = { ...p, cantidad: e.target.value }; setForm({ ...form, paquetes: ps }) }} />
          <input placeholder="Etiqueta" value={p.etiqueta || ''} onChange={(e) => { const ps = [...form.paquetes]; ps[i] = { ...p, etiqueta: e.target.value }; setForm({ ...form, paquetes: ps }) }} />
          <button type="button" className="chip" onClick={() => setForm({ ...form, paquetes: form.paquetes.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="chip" onClick={() => setForm({ ...form, paquetes: [...form.paquetes, { nombre: '', cantidad: 0 }] })}>+ Paquete</button>
      <div className="row gap"><button className="btn">Guardar</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancelar</button></div>
    </form>
  )

  return (
    <>
      <div className="toolbar"><h3>Dinámicas</h3><button className="btn" onClick={nuevo}>+ Nueva</button></div>
      {lista.map((d) => (
        <div className="card fila-card" key={d.id}>
          <div>
            <strong>{d.titulo}</strong> <span className={'badge ' + (d.estado === 'activa' ? 'ok' : '')}>{d.estado}</span>
            <p className="small muted">{d.slug ? `/rifa/${d.slug} · ` : ''}{money(d.precio_numero)} · {d.total_numeros} números{d.numero_ganador != null ? ` · Ganador: ${pad(d.numero_ganador, d.total_numeros)}` : ''}</p>
          </div>
          <div className="row gap">
            <button className="chip" onClick={() => setForm({ ...d, paquetes: d.paquetes.sort((a, b) => a.orden - b.orden) })}>Editar</button>
            <button className="chip" onClick={() => ganador(d)}>Marcar ganador</button>
            {d.slug && <button className="chip" onClick={async () => {
              const url = `${window.location.origin}/rifa/${d.slug}`
              try { await navigator.clipboard.writeText(url); alert('Link copiado:\n' + url) } catch { prompt('Copia el link:', url) }
            }}>Copiar link</button>}
          </div>
        </div>
      ))}
    </>
  )
}

/* ---------- Cuentas ---------- */
function Cuentas() {
  const [lista, setLista] = useState([])
  const vacio = { banco: '', tipo_cuenta: 'Ahorros', numero_cuenta: '', titular: '', cedula_rnc: '', activo: true, logo_url: '' }
  const [subiendo, setSubiendo] = useState(false)
  const subirLogo = async (f) => {
    if (!f) return
    setSubiendo(true)
    try {
      const r = await optimizarImagen(f, { maxLado: 256, calidad: 0.9 })
      const path = `bancos/${crypto.randomUUID()}.webp`
      const { error } = await supabase.storage.from('premios').upload(path, r.file, { contentType: 'image/webp', cacheControl: '31536000' })
      if (error) throw error
      setForm((fm) => ({ ...fm, logo_url: supabase.storage.from('premios').getPublicUrl(path).data.publicUrl }))
    } catch (e) { alert('No se pudo subir el icono. Intenta de nuevo.') } finally { setSubiendo(false) }
  }
  const [form, setForm] = useState(vacio)

  const cargar = async () => {
    const { data } = await supabase.from('metodos_pago').select('*').order('orden')
    setLista(data || [])
  }
  useEffect(() => { cargar() }, [])

  const guardar = async (e) => {
    e.preventDefault()
    const { id, ...d } = form
    const { error } = id ? await supabase.from('metodos_pago').update(d).eq('id', id) : await supabase.from('metodos_pago').insert({ ...d, orden: lista.length })
    if (error) return alert('No se pudo guardar. Intenta de nuevo.')
    setForm(vacio); cargar()
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <>
      <form className="card" onSubmit={guardar}>
        <h3>{form.id ? 'Editar cuenta' : 'Agregar cuenta'}</h3>
        <div className="grid2">
          <label>Banco<input required value={form.banco} onChange={set('banco')} /></label>
          <label>Tipo<select value={form.tipo_cuenta} onChange={set('tipo_cuenta')}><option>Ahorros</option><option>Corriente</option></select></label>
          <label>Número de cuenta<input required value={form.numero_cuenta} onChange={set('numero_cuenta')} /></label>
          <label>Titular<input required value={form.titular} onChange={set('titular')} /></label>
          <label>Cédula / RNC<input value={form.cedula_rnc || ''} onChange={set('cedula_rnc')} /></label>
          <div className="campo">Icono del banco
            <div className="row gap logo-edit">
              <LogoBanco m={form} />
              <label className="btn ghost file-btn">{subiendo ? 'Subiendo…' : form.logo_url ? 'Cambiar icono' : 'Subir icono'}
                <input type="file" accept="image/*" disabled={subiendo} onChange={(e) => subirLogo(e.target.files[0])} /></label>
              {form.logo_url && <button type="button" className="chip" onClick={() => setForm({ ...form, logo_url: '' })}>Quitar</button>}
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activa</label>
        </div>
        <div className="row gap"><button className="btn">Guardar</button>{form.id && <button type="button" className="btn ghost" onClick={() => setForm(vacio)}>Cancelar</button>}</div>
      </form>
      {lista.map((m) => (
        <div className="card fila-card" key={m.id}>
          <div className="banco-inline"><LogoBanco m={m} /><strong>{m.banco}</strong> · {m.tipo_cuenta} {!m.activo && <span className="badge">inactiva</span>}
            <p className="small muted mono">{m.numero_cuenta} · {m.titular}</p></div>
          <button className="chip" onClick={() => setForm(m)}>Editar</button>
        </div>
      ))}
    </>
  )
}
