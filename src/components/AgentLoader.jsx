/** Indicador de “respondiendo” — 4 puntos escalonados */
export default function AgentLoader({ size = 'md', className = '' }) {
  const isSm = size === 'sm';
  return (
    <div
      className={`agent-loader ${isSm ? 'agent-loader--sm' : ''} ${className}`}
      role="status"
      aria-label="El asistente está respondiendo"
    >
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
