import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, money } from '../lib/supabase'

export default function Home() {
  const [rifas, setRifas] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('dinamicas')
        .select('id,titulo,imagen_url,precio_numero,fecha_sorteo,created_at')
        .eq('estado', 'activa').order('created_at', { ascending: false })
      const lista = data || []
      const progresos = await Promise.all(lista.map((d) => supabase.rpc('progreso', { p_dinamica: d.id })))
      setRifas(lista.map((d, i) => ({ ...d, prog: progresos[i].data })))
    })()
  }, [])

  if (!rifas) return <div className="center pad"><div className="spinner" /> Cargando rifas…</div>

  if (rifas.length === 0) return (
    <section className="hero">
      <h1 className="display">Próximamente</h1>
      <p>No hay rifas activas en este momento. Síguenos en Instagram para enterarte de la próxima.</p>
    </section>
  )

  return (
    <>
      <section className="hero hero-sm">
        <p className="eyebrow">Rifas activas</p>
        <h1 className="display">Elige tu rifa</h1>
      </section>
      <section className="section">
        <div className="rifas">
          {rifas.map((r) => {
            const raw = r.prog?.meta ? (r.prog.vendidos / r.prog.meta) * 100 : 0
            const pct = Math.min(100, raw)
            const pctTxt = raw > 0 && raw < 10 ? raw.toFixed(1) : Math.round(pct)
            return (
              <Link key={r.id} to={`/rifa/${r.id}`} className="rifa-card">
                <div className="rifa-img">
                  {r.imagen_url ? <img src={r.imagen_url} alt={r.titulo} loading="lazy" /> : <span>NASHLA´S</span>}
                </div>
                <div className="rifa-body">
                  <h3>{r.titulo}</h3>
                  <div className="rifa-meta">
                    <span><strong>{money(r.precio_numero)}</strong> <small>por número</small></span>
                    {r.fecha_sorteo && <span className="muted small">Sorteo: {new Date(r.fecha_sorteo).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                  <div className="progress claro"><div style={{ width: (pct > 0 ? Math.max(pct, 2) : 0) + '%' }} /></div>
                  <p className="muted small">{pctTxt}% vendido</p>
                  <span className="btn block">Jugar</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </>
  )
}
