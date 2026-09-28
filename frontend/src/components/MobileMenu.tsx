import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { SECTION_CHANGE_EVENT, SECTION_GOTO_EVENT, sectionForPath, type NavLink } from '../lib/navegacion';

interface Props {
  links: NavLink[];
  cta: NavLink;
  pathname: string;
}

const PANEL_ID = 'mobile-menu-panel';
const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Menú hamburguesa para <1024px. Mientras está abierto: foco atrapado
 * (botón + panel), Escape cierra, scroll del body bloqueado.
 * El enlace activo lo decide el scrollspy del header (evento `section:change`).
 */
export default function MobileMenu({ links, cta, pathname }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(() => sectionForPath(pathname));
  // Sección a la que desplazarse una vez cerrado el panel.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  useEffect(() => {
    // El scrollspy pudo emitir antes de hidratar la isla: se toma el último valor publicado.
    const published = document.documentElement.dataset.activeSection;
    if (published) setActive(published);
    const onChange = (e: Event) => setActive((e as CustomEvent<string | null>).detail);
    window.addEventListener(SECTION_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(SECTION_CHANGE_EVENT, onChange);
  }, []);

  // Primero se cierra el panel (y el cleanup de abajo libera el scroll del body);
  // recién después se pide el desplazamiento, o el scroll se cancelaría.
  useEffect(() => {
    if (open || !pendingId) return;
    const id = pendingId;
    setPendingId(null);
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(SECTION_GOTO_EVENT, { detail: id })));
  }, [open, pendingId]);

  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>, link: NavLink) => {
    const plainClick = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (plainClick && window.location.pathname === '/' && document.getElementById(link.id)) {
      e.preventDefault();
      setPendingId(link.id);
    }
    // En una subpágina el router de Astro navega a "/#seccion".
    close(false);
  };

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !rootRef.current) return;
      const items = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Si la ventana crece a escritorio con el menú abierto, se cierra.
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onDesktop = (e: MediaQueryListEvent) => e.matches && close(false);

    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [open]);

  return (
    <div className="mnav" ref={rootRef} data-mnav>
      <button
        ref={toggleRef}
        type="button"
        className="mnav__toggle"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`mnav__bars ${open ? 'is-open' : ''}`} aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <div id={PANEL_ID} ref={panelRef} className="mnav__panel" hidden={!open}>
        <nav aria-label="Navegación principal (móvil)">
          <ul>
            {links.map((l) => {
              const isCurrent = l.id === active;
              return (
                <li key={l.id}>
                  <a
                    href={l.href}
                    className={`mnav__link ${isCurrent ? 'is-active' : ''}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={(e) => onLinkClick(e, l)}
                  >
                    {l.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <a href={cta.href} className="btn mnav__cta" onClick={(e) => onLinkClick(e, cta)}>
          {cta.label}
        </a>
      </div>

      <style>{`
        .mnav { justify-self: end; }
        @media (min-width: 1024px) { .mnav { display: none; } }

        .mnav__toggle {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          background: var(--color-header-bg);
          border: 1px solid var(--color-header-divider);
          border-radius: var(--radius);
          color: var(--color-brand-blue);
          cursor: pointer;
        }
        .mnav__toggle:hover { background: var(--color-brand-blue-tint); }

        .mnav__toggle:focus-visible,
        .mnav__link:focus-visible,
        .mnav__cta:focus-visible {
          outline: 2px solid var(--color-brand-blue);
          outline-offset: 2px;
        }

        .mnav__bars { position: relative; width: 20px; height: 14px; display: block; }
        .mnav__bars span {
          position: absolute;
          left: 0;
          width: 100%;
          height: 2px;
          border-radius: 2px;
          background: currentColor;
          transition: transform 0.2s ease, opacity 0.2s ease, top 0.2s ease;
        }
        .mnav__bars span:nth-child(1) { top: 0; }
        .mnav__bars span:nth-child(2) { top: 6px; }
        .mnav__bars span:nth-child(3) { top: 12px; }
        .mnav__bars.is-open span:nth-child(1) { top: 6px; transform: rotate(45deg); }
        .mnav__bars.is-open span:nth-child(2) { opacity: 0; }
        .mnav__bars.is-open span:nth-child(3) { top: 6px; transform: rotate(-45deg); }

        .mnav__panel {
          position: fixed;
          inset: var(--header-height) 0 0 0;
          background: var(--color-header-bg);
          padding: 1.25rem clamp(1rem, 4vw, 2.5rem) 2rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .mnav__panel[hidden] { display: none; }
        .mnav__panel ul { list-style: none; margin: 0; padding: 0; }
        .mnav__panel li {
          margin: 0;
          padding-block: 0.25rem;
          border-bottom: 1px solid var(--color-header-divider);
        }
        .mnav__panel li:last-child { border-bottom: 0; }

        .mnav__link {
          display: block;
          padding: 0.8rem 1rem;
          border-radius: var(--radius);
          color: var(--color-brand-blue);
          font-size: 1.05rem;
          font-weight: 500;
          transition: background-color 0.18s ease;
        }
        .mnav__link:hover {
          background: var(--color-brand-blue-tint);
          text-decoration: none;
        }
        .mnav__link[aria-current='page'] {
          background: var(--color-brand-blue-tint);
          font-weight: 600;
        }

        .mnav__cta {
          justify-content: center;
          background: var(--color-brand-blue);
          color: var(--color-on-brand-blue);
          font-weight: 600;
        }
        .mnav__cta:hover,
        .mnav__cta:active { background: var(--color-brand-blue-hover); }
      `}</style>
    </div>
  );
}
