import { NavLink, Outlet, Link } from 'react-router-dom'
import { WHATSAPP, WHATSAPP_LABEL, INSTAGRAM } from '../lib/supabase'

export default function Layout() {
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">
          <span className="brand-name">NASHLA´S</span>
          <span className="brand-sub">SHOP</span>
        </Link>
        <nav>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/verificador">Verificador</NavLink>
        </nav>
      </header>

      <main><Outlet /></main>

      <footer className="footer">
        <div className="footer-grid">
          <div>
            <h4>Contacto</h4>
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp {WHATSAPP_LABEL}</a>
          </div>
          <div>
            <h4>Síguenos</h4>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer">Instagram @nashlasshop</a>
            <p className="muted">Sorteos en vivo y resultados oficiales</p>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to="/terminos">Términos y Condiciones</Link>
          </div>
        </div>
        <p className="legal">
          Promoción no patrocinada ni administrada por Meta Platforms, Inc. Solo para mayores de 18 años.
          <br />© {new Date().getFullYear()} Nashla´s Shop · Multi tienda
        </p>
      </footer>

      <a className="wa-float" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4.1 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>
      </a>
    </>
  )
}
