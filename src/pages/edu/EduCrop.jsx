import { useState } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No pude leer esa imagen'));
    image.src = src;
  });
}

export async function cropToFile(src, pixels, { round = false } = {}) {
  const image = await loadImage(src);
  const width = round ? 640 : 1400;
  const height = round ? 640 : Math.max(320, Math.round(1400 * (pixels.height / Math.max(pixels.width, 1))));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('No pude recortar la foto');
  return new File([blob], round ? 'perfil.jpg' : 'portada.jpg', { type: 'image/jpeg' });
}

export default function EduCrop({ image, round, title, onCancel, onUse }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function useCrop() {
    if (!area) return;
    setBusy(true);
    setError('');
    try {
      const file = await cropToFile(image, area, { round });
      await onUse(file);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la foto');
      setBusy(false);
    }
  }

  return (
    <div className="edu-crop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="edu-crop-card">
        <h2>{title}</h2>
        <p>Arrastra la foto y usa el zoom para encuadrar solo la parte que quieres mostrar.</p>
        <div className="edu-crop-stage">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={round ? 1 : 2.6}
            cropShape={round ? 'round' : 'rect'}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(event) => setZoom(Number(event.target.value))}
        />
        {error ? <p className="edu-error">{error}</p> : null}
        <div className="edu-crop-actions">
          <button type="button" className="edu-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="edu-btn" onClick={useCrop} disabled={busy || !area}>
            {busy ? 'Guardando…' : 'Usar esta foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
