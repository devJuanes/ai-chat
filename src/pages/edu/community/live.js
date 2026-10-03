import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { refreshPulse } from '../pulse';

export function whenLabel(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(date);
}

export function useCollection(path, key) {
  const auth = useAuth();
  const [rows, setRows] = useState([]);
  const [extra, setExtra] = useState({});
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const json = await api(path, { token: auth.getToken() });
    setRows(Array.isArray(json[key]) ? json[key] : []);
    setExtra(json);
    setError('');
    return json;
  }, [auth, path, key]);

  useEffect(() => {
    let stop = false;
    reload()
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude cargar esta sección');
      })
      .finally(() => {
        if (!stop) setReady(true);
      });
    return () => {
      stop = true;
    };
  }, [reload]);

  return { rows, setRows, extra, error, setError, ready, reload };
}

export async function uploadImage(token, file) {
  if (!file) return '';
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error('Usa una imagen JPG, PNG o WebP.');
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No pude leer la imagen'));
    reader.readAsDataURL(file);
  });
  const json = await api('/api/edu/media', { method: 'POST', token, body: { data } });
  return json.url;
}

export async function postAction(token, path, body) {
  const json = await api(path, { method: 'POST', token, body });
  refreshPulse(token);
  return json;
}
