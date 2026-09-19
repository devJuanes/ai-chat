export function BrandMascot({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M42 28h110l36 36v138c0 8-6 14-14 14H42c-8 0-14-6-14-14V42c0-8 6-14 14-14Z"
        fill="#f9f5f2"
        stroke="#000"
        strokeWidth="3"
      />
      <path d="M152 28v30h30" fill="#f4ed36" stroke="#000" strokeWidth="3" />
      <circle cx="88" cy="108" r="7" fill="#000" />
      <circle cx="128" cy="108" r="7" fill="#000" />
      <path
        d="M92 132c8 12 28 12 36 0"
        stroke="#000"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="72" cy="122" rx="10" ry="5" fill="#f8c1ba" opacity="0.9" />
      <ellipse cx="144" cy="122" rx="10" ry="5" fill="#f8c1ba" opacity="0.9" />
      <path
        d="M168 78l6 14 14 6-14 6-6 14-6-14-14-6 14-6 6-14Z"
        fill="#f4ed36"
        stroke="#000"
        strokeWidth="2.5"
      />
      <path
        d="M78 216v18M130 216v18"
        stroke="#000"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M66 234h24M118 234h24"
        stroke="#000"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
