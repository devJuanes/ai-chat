/**
 * Anillo de carga del inbox: 44px, borde negro, arco amarillo, sin texto.
 * overlay: capa transparente a pantalla completa del contenedor relativo.
 */
export default function LoadingRing({ overlay = false, className = '' }) {
  const position = overlay
    ? 'pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-transparent'
    : 'flex items-center justify-center bg-transparent';

  return (
    <div
      className={className ? `${position} ${className}` : position}
      role="status"
      aria-busy="true"
    >
      <span className="h-11 w-11 animate-spin rounded-full border-[3px] border-black border-t-[#f4ed36]" />
    </div>
  );
}
