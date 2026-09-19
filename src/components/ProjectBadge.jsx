import { ProjectIcon } from './ProjectIcons';
import { getProjectColor, getProjectIconId } from '../lib/projectTheme';

export default function ProjectBadge({
  project,
  size = 28,
  className = '',
}) {
  const color = getProjectColor(project?.color);
  const icon = getProjectIconId(project?.icon);
  const radius = size >= 40 ? 14 : size >= 32 ? 10 : 8;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-pure-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color.bg,
      }}
      aria-hidden="true"
    >
      <ProjectIcon
        id={icon}
        className={size >= 40 ? 'h-5 w-5' : 'h-3.5 w-3.5'}
      />
    </span>
  );
}
