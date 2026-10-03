import { useState } from 'react';
import { uploadImage } from './live';
import Icon from './icons';

export function LiveState({ ready, error, empty, children }) {
  if (!ready) {
    return (
      <div className="edu-cm-feed" aria-busy="true" aria-label="Cargando">
        <div className="edu-cm-skel" />
        <div className="edu-cm-skel is-short" />
      </div>
    );
  }
  return (
    <>
      {error ? <div className="edu-error">{error}</div> : null}
      {empty ? (
        <div className="edu-cm-empty">
          <strong>{empty}</strong>
        </div>
      ) : (
        children
      )}
    </>
  );
}

export function ImageField({ onUrl, token }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setNote('');
    try {
      const url = await uploadImage(token, file);
      onUrl(url);
      setNote('Imagen lista');
    } catch (err) {
      setNote(err.message || 'No se pudo subir');
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="edu-cm-photo" aria-label={busy ? 'Subiendo imagen' : 'Subir imagen'}>
      <Icon name="image" />
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} />
      {note ? <span className="edu-sr">{note}</span> : null}
    </label>
  );
}
