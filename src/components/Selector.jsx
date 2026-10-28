import { useEffect, useRef, useState } from 'react'

// Selector con diseño propio (reemplaza al <select> nativo).
// opciones: [{ value, label, sub?, img? }]
export default function Selector({ opciones, value, onChange, placeholder = 'Seleccionar' }) {
  const [abierto, setAbierto] = useState(false)
  const [foco, setFoco] = useState(0)
  const ref = useRef(null)
  const actual = opciones.find((o) => o.value === value)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('touchstart', fuera)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('touchstart', fuera) }
  }, [abierto])

  const elegir = (o) => { onChange(o.value); setAbierto(false) }

  const teclado = (e) => {
    if (e.key === 'Escape') return setAbierto(false)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!abierto) { setAbierto(true); setFoco(Math.max(0, opciones.indexOf(actual))); return }
      setFoco((f) => (f + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length)
    }
    if ((e.key === 'Enter' || e.key === ' ') && abierto && opciones[foco]) { e.preventDefault(); elegir(opciones[foco]) }
  }

  const Item = ({ o }) => (
    <>
      {o.img !== undefined && <span className="sel-thumb">{o.img ? <img src={o.img} alt="" /> : <span>N</span>}</span>}
      <span className="sel-txt"><span className="sel-label">{o.label}</span>{o.sub && <span className="sel-sub">{o.sub}</span>}</span>
    </>
  )

  return (
    <div className={'sel' + (abierto ? ' abierto' : '')} ref={ref} onKeyDown={teclado}>
      <button type="button" className="sel-btn" aria-haspopup="listbox" aria-expanded={abierto}
        onClick={() => { setAbierto(!abierto); setFoco(Math.max(0, opciones.indexOf(actual))) }}>
        {actual ? <Item o={actual} /> : <span className="sel-txt muted">{placeholder}</span>}
        <svg className="sel-flecha" viewBox="0 0 20 20" width="18" height="18"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {abierto && (
        <ul className="sel-lista" role="listbox">
          {opciones.length === 0 && <li className="sel-vacio">No hay opciones</li>}
          {opciones.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}
              className={(o.value === value ? 'activo ' : '') + (i === foco ? 'foco' : '')}
              onMouseEnter={() => setFoco(i)} onClick={() => elegir(o)}>
              <Item o={o} />
              {o.value === value && <svg className="sel-check" viewBox="0 0 20 20" width="18" height="18"><path d="M4 10l4 4 8-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
