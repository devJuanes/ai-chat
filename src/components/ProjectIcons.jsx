const sw = 1.5;
const size = 18;

const base = {
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function BriefcaseIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </svg>
  );
}

export function RocketIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 15c1.5 1 3.5 2 6 2s4.5-1 6-2c0-5-2.5-10-6-12-3.5 2-6 7-6 12Z" />
      <path d="M9 14c0 1.5.5 3 1.5 4.5M15 14c0 1.5-.5 3-1.5 4.5M10 9.5h.01M14 11h.01" />
    </svg>
  );
}

export function TargetIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function CodeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
    </svg>
  );
}

export function ChartIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />
    </svg>
  );
}

export function BulbIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10c-.8.7-1.2 1.5-1.4 2.5H9.4C9.2 14.5 8.8 13.7 8 13a6 6 0 0 1 4-10Z" />
    </svg>
  );
}

export function UsersIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17 14a5 5 0 0 1 4 5" />
    </svg>
  );
}

export function CartIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 4h2l2.5 11h10l2-7H7" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </svg>
  );
}

export function BuildingIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h16M6 20V6l6-2 6 2v14M10 9h.01M14 9h.01M10 13h.01M14 13h.01M10 17h.01M14 17h.01" />
    </svg>
  );
}

export function FlaskIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
    </svg>
  );
}

export function PenIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function SparkMiniIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}

const MAP = {
  briefcase: BriefcaseIcon,
  rocket: RocketIcon,
  target: TargetIcon,
  code: CodeIcon,
  chart: ChartIcon,
  bulb: BulbIcon,
  users: UsersIcon,
  cart: CartIcon,
  building: BuildingIcon,
  flask: FlaskIcon,
  pen: PenIcon,
  spark: SparkMiniIcon,
};

export function ProjectIcon({ id, className }) {
  const Icon = MAP[id] || BriefcaseIcon;
  return <Icon className={className} />;
}
