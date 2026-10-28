import { useEffect, useRef, useState } from 'react'

const reducido = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const VUELTAS = 3

// Número de 4 cifras que gira como los tambores de una tómbola y se detiene en `valor`.
// Sin `valor`, elige uno al azar y vuelve a girar al tocarlo.
export default function Tambor({ valor, cifras = 4, retraso = 0, tam = 'grande' }) {
  const fijo = valor != null
  const [pos, setPos] = useState(() => Array(cifras).fill(0))
  const [anim, setAnim] = useState(false)
  const actual = useRef(Array(cifras).fill(0))

  const girarA = (num) => {
    const dig = String(num).padStart(cifras, '0').split('').map(Number)
    if (reducido()) { actual.current = dig; setAnim(false); setPos(dig); return }
    // 1) volver sin animación a la posición base del dígito actual
    setAnim(false)
    setPos(actual.current)
    // 2) en el siguiente cuadro, rodar varias vueltas hasta el nuevo dígito
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setAnim(true)
      setPos(dig.map((d) => VUELTAS * 10 + d))
      actual.current = dig
    }))
  }

  useEffect(() => {
    const t = setTimeout(() => girarA(fijo ? valor : Math.floor(Math.random() * 10 ** cifras)), 150 + retraso)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, cifras, retraso])

  const texto = actual.current.join('')

  return (
    <button type="button" className={`tambor tambor-${tam}`} aria-label={`Número ${texto}`}
      tabIndex={fijo ? -1 : 0} disabled={fijo}
      onClick={() => !fijo && girarA(Math.floor(Math.random() * 10 ** cifras))}>
      {pos.map((p, i) => (
        <span className="t-celda" key={i} aria-hidden="true">
          <span className="t-tira" style={{
            transform: `translateY(-${p}em)`,
            transition: anim ? undefined : 'none',
            transitionDelay: anim ? `${i * 140}ms` : '0ms',
          }}>
            {Array.from({ length: (VUELTAS + 1) * 10 }, (_, k) => <span key={k}>{k % 10}</span>)}
          </span>
        </span>
      ))}
    </button>
  )
}
