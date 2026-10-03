const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.8',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export default function Icon({ name }) {
  if (name === 'people') {
    return (
      <svg {...common}>
        <path d="M8.2 10.2a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z" />
        <path d="M15.6 9.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z" />
        <path d="M3.8 17.6c.5-2.2 2.2-3.5 4.4-3.5s3.9 1.3 4.4 3.5" />
        <path d="M13.2 14.5c1.5.2 2.8 1.2 3.4 3.1" />
      </svg>
    );
  }
  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="M4 10.8 12 4.5l8 6.3V19a1 1 0 0 1-1 1h-5.2v-5.2H10.2V20H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === 'chat') {
    return (
      <svg {...common}>
        <path d="M6.2 16.2 4.5 19V7.2A1.7 1.7 0 0 1 6.2 5.5h11.6A1.7 1.7 0 0 1 19.5 7.2v7.3a1.7 1.7 0 0 1-1.7 1.7z" />
      </svg>
    );
  }
  if (name === 'trophy') {
    return (
      <svg {...common}>
        <path d="M8 4.5h8v5.2a4 4 0 0 1-8 0z" />
        <path d="M8 6.2H5.8A2.3 2.3 0 0 0 8 9.5M16 6.2h2.2A2.3 2.3 0 0 1 16 9.5" />
        <path d="M12 13.7V16M9.2 19.5h5.6" />
      </svg>
    );
  }
  if (name === 'code') {
    return (
      <svg {...common}>
        <path d="m8 8-3.5 4L8 16M16 8l3.5 4L16 16" />
      </svg>
    );
  }
  if (name === 'users') {
    return (
      <svg {...common}>
        <circle cx="9" cy="9" r="2.4" />
        <path d="M4.6 17.2c.5-2 2.1-3.2 4.4-3.2s3.9 1.2 4.4 3.2" />
        <circle cx="16.2" cy="9.2" r="1.8" />
        <path d="M15.2 14.2c1.5.2 2.7 1.2 3.2 3" />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
        <path d="M8 4v3M16 4v3M4.5 10h15" />
      </svg>
    );
  }
  if (name === 'pencil') {
    return (
      <svg {...common}>
        <path d="M13.2 6.2 17.8 10.8 9.2 19.4H4.6v-4.6z" />
        <path d="m12 7.4 4.6 4.6" />
      </svg>
    );
  }
  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M5 19V10M10 19V5M15 19v-6M20 19V8" />
      </svg>
    );
  }
  if (name === 'bolt') {
    return (
      <svg {...common}>
        <path d="M13 3.5 6.5 13H12l-1 7.5L17.5 11H12z" />
      </svg>
    );
  }
  if (name === 'chevron') {
    return (
      <svg {...common}>
        <path d="m9 6 6 6-6 6" />
      </svg>
    );
  }
  if (name === 'coin') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8.5v7M10 10.2c.4-.6 1.1-.9 2-.9 1.1 0 1.8.5 1.8 1.4S13.2 12 12 12s-2 .5-2 1.4.8 1.5 2 1.5c.9 0 1.6-.3 2-.8" />
      </svg>
    );
  }
  if (name === 'bookmark') {
    return (
      <svg {...common}>
        <path d="M7.2 4.8h9.6a1 1 0 0 1 1 1V20l-5.8-3.1L6.2 20V5.8a1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (name === 'book') {
    return (
      <svg {...common}>
        <path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H7.2A2.2 2.2 0 0 0 5 21.2z" />
        <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H17v16" />
      </svg>
    );
  }
  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M6.5 16.5h11l-.8-2.1a6 6 0 0 1-.6-2.6V9.2a4.1 4.1 0 0 0-8.2 0v2.6c0 .9-.2 1.8-.6 2.6z" />
        <path d="M10 16.8a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="M5 12.5 9.2 17 19 7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M8 11.2V19" />
      <path d="M8 11.2h2.1a2 2 0 0 0 1.8-1.1L13.6 6.8A1.7 1.7 0 0 1 15.2 5.5H16a1.4 1.4 0 0 1 1.4 1.7l-.5 3.2H19a1.8 1.8 0 0 1 1.8 2.1l-.6 4.6a1.8 1.8 0 0 1-1.8 1.5H8" />
    </svg>
  );
}
