import { useEffect, useState } from 'react'
import { supabase, pad, money, WHATSAPP } from '../lib/supabase'
import Selector from '../components/Selector'

export default function Verificador() {
  return (
    <section className="section narrow">
      <h1 className="display sm">Verificador</h1>
      <MisNumeros />
    </section>
  )
}

function MisNumeros() {
  const [dinamicas, setDinamicas] = useState([])
  const [din, setDin] = useState('')
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [ultima, setUltima] = useState(0)

  useEffect(() => {
    supabase.from('dinamicas').select('id,titulo,total_numeros,imagen_url,precio_numero')
      .eq('estado', 'activa').order('created_at', { ascending: false })
      .then(({ data }) => { setDinamicas(data || []); if (data?.[0]) setDin(data[0].id) })
  }, [])

  const d = dinamicas.find((x) => x.id === din)
  const fmt = (n) => pad(n, d?.total_numeros || 10000)

  const buscar = async (e) => {
    e.preventDefault()
    const limpio = q.replace(/\D/g, '')
    if (!din) return setError('Selecciona una rifa.')
    if (!limpio) return setError('Escribe tu teléfono o un número asignado.')
    if (limpio.length > 6 && limpio.length < 10) return setError('El teléfono debe tener 10 dígitos.')
    if (Date.now() - ultima < 3000) return setError('Espera unos segundos antes de buscar otra vez.')
    setUltima(Date.now()); setError(''); setCargando(true); setRes(null)
    const { data, error } = await supabase.rpc('verificar', { p_dinamica: din, p_query: limpio })
    setCargando(false)
    if (error) return setError('No pudimos conectar. Revisa tu conexión e intenta de nuevo. Esto no afecta tu compra.')
    setRes({ porNumero: limpio.length < 10, filas: data || [] })
  }

  const aprobados = res?.filas.filter((r) => r.estado === 'aprobada') || []
  const pendientes = res?.filas.filter((r) => r.estado === 'pendiente') || []

  return (
    <>
      <form className="card" onSubmit={buscar}>
        <div className="campo"><span className="paso">Paso 1 de 2</span> Selecciona la rifa
          <Selector
            value={din}
            placeholder={dinamicas.length ? 'Elige una rifa' : 'No hay rifas activas'}
            onChange={(v) => { setDin(v); setRes(null) }}
            opciones={dinamicas.map((x) => ({ value: x.id, label: x.titulo, sub: `${money(x.precio_numero)} por número`, img: x.imagen_url || null }))}
          />
        </div>
        <label><span className="paso">Paso 2 de 2</span> Tu teléfono o un número asignado
          <input inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} placeholder="829 555 5555  o  0427" />
          <small className="muted">Usa el mismo teléfono que pusiste al comprar.</small>
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn block" disabled={cargando}>{cargando ? 'Buscando…' : 'Buscar'}</button>
        <p className="muted small center">‼️ No enviamos números por WhatsApp. Aparecen aquí cuando se aprueba tu pago (máx. 24h).</p>
      </form>

      {res && (
        <div className="card">
          {res.filas.length === 0 ? (
            <div className="center">
              <h3>Todavía no vemos tus números</h3>
              <p className="muted small">Si compraste hace menos de 24 horas, aún está en validación. Verifica que el teléfono sea el mismo de la compra.</p>
              <a className="btn ghost" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">Escríbenos por WhatsApp</a>
            </div>
          ) : res.porNumero ? (
            <div className="center">
              <div className="nums"><span>{fmt(res.filas[0].numero)}</span></div>
              <p>{res.filas[0].estado === 'aprobada' ? <>Asignado a <strong>{res.filas[0].nombre}</strong></> : 'Este número está en validación.'}</p>
            </div>
          ) : (
            <>
              {aprobados.length > 0 && <>
                <p className="small"><span className="badge ok">Aprobados</span> {aprobados.length} números</p>
                <div className="nums">{aprobados.map((r) => <span key={r.numero}>{fmt(r.numero)}</span>)}</div>
              </>}
              {pendientes.length > 0 && <div className="aviso"><strong>Tu compra está en validación</strong>
                <p>{pendientes.length} números aparecerán aquí al aprobarse tu pago, normalmente en menos de 24 horas.</p></div>}
            </>
          )}
        </div>
      )}
    </>
  )
}
