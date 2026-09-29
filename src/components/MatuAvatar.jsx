/** Avatar de Matu para chats y soporte. Recorta cara o busto y oculta el pie de la foto. */
export default function MatuAvatar({
  size = 32,
  className = '',
  crop = 'face',
  alt = 'Matu',
  decorative = false,
}) {
  const bust = crop === 'bust';

  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden border-2 border-black bg-[#1a1a1a] ${
        bust ? 'rounded-[22px]' : 'rounded-full'
      } ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src="/avatar-matuai.png"
        alt={decorative ? '' : alt}
        width={size}
        height={size}
        decoding="async"
        className="absolute left-0 top-0 w-full max-w-none object-cover object-top"
        style={{ height: bust ? '112%' : '188%' }}
      />
    </span>
  );
}
