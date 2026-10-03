import { Link } from 'react-router-dom';

export default function PersonFace({ name, src, href, className = 'edu-forum-avatar' }) {
  const letter = String(name || 'E').trim().slice(0, 1).toUpperCase();
  const face = src ? <img src={src} alt="" /> : letter;
  if (href) {
    return (
      <Link to={href} className={className}>
        {face}
      </Link>
    );
  }
  return <span className={className}>{face}</span>;
}
