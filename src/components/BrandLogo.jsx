/** Logo oficial Matu AI (opción papeles). */
export default function BrandLogo({
  className = '',
  alt = 'Matu AI',
  size,
  decorative = false,
}) {
  const style =
    size != null
      ? { width: size, height: size }
      : undefined;

  return (
    <img
      src="/logo.png"
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? true : undefined}
      width={size || 64}
      height={size || 64}
      style={style}
      className={`object-contain ${className}`.trim()}
      decoding="async"
    />
  );
}
