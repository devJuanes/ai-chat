import { useState } from 'react';

export default function EduCover({ src, className = 'edu-cover' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`${className} edu-cover-empty`} />;
  return (
    <img
      className={className}
      src={src}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
