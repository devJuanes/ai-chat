export function ConfettiBit({ className = '', fill = '#f8c1ba' }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="20"
        height="20"
        rx="3"
        fill={fill}
        stroke="#000"
        strokeWidth="2"
        transform="rotate(12 14 14)"
      />
    </svg>
  );
}
