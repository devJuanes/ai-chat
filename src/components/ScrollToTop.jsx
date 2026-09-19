import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Al cambiar de ruta, siempre empieza arriba (evita “quedarse” en el footer). */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    const reset = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll('.landing, .fp').forEach((node) => {
        node.scrollTop = 0;
      });
    };

    reset();
    // Un frame extra por si el layout aún no midió la nueva página
    requestAnimationFrame(reset);
  }, [pathname, search, hash]);

  return null;
}
