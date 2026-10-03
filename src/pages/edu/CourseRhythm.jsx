import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';

const CADENCE = [
  { id: '', label: 'Sin horario' },
  { id: 'daily', label: 'Todos los días' },
  { id: 'weekdays', label: 'Entre semana' },
  { id: 'weekly', label: 'Un día a la semana' },
];

const DAYS = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 7, label: 'Domingo' },
];

export function rhythmLabel(plan) {
  if (!plan?.cadence || !plan.session_time) return 'Sin horario fijo';
  const time = plan.session_time;
  if (plan.cadence === 'daily') return `Todos los días a las ${time}`;
  if (plan.cadence === 'weekdays') return `Lunes a viernes a las ${time}`;
  const day = DAYS.find((item) => item.id === Number(plan.session_weekday))?.label || 'Lunes';
  return `Cada ${day.toLowerCase()} a las ${time}`;
}

export default function CourseRhythm({ course, onSaved }) {
  const auth = useAuth();
  const [cadence, setCadence] = useState(course.cadence || '');
  const [time, setTime] = useState(course.session_time || '19:00');
  const [weekday, setWeekday] = useState(String(course.session_weekday || 1));
  const [minutes, setMinutes] = useState(String(course.session_minutes || 45));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNote('');
    try {
      await api(`/api/edu/courses/${course.id}/plan`, {
        method: 'POST',
        token: auth.getToken(),
        body: {
          cadence,
          session_time: time,
          session_weekday: Number(weekday),
          session_minutes: Number(minutes) || 45,
        },
      });
      setNote(cadence ? 'Listo. Te escribimos 15 minutos antes.' : 'Horario quitado.');
      onSaved?.();
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="edu-rhythm">
      <summary>
        <strong>Constancia</strong>
        <span>{rhythmLabel({ cadence, session_time: time, session_weekday: Number(weekday) })}</span>
      </summary>
      <form onSubmit={save}>
      <p>Elige cada cuánto aparece este curso en tu calendario. El correo llega 15 minutos antes.</p>
      <label>
        Frecuencia
        <select value={cadence} onChange={(event) => setCadence(event.target.value)}>
          {CADENCE.map((item) => (
            <option key={item.id || 'none'} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Hora
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required={Boolean(cadence)} />
      </label>
      {cadence === 'weekly' ? (
        <label>
          Día
          <select value={weekday} onChange={(event) => setWeekday(event.target.value)}>
            {DAYS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Minutos
        <input
          inputMode="numeric"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
        />
      </label>
      <button className="edu-btn" type="submit" disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar horario'}
      </button>
      {note ? <p className="edu-rhythm-note">{note}</p> : null}
      {error ? <div className="edu-error">{error}</div> : null}
      </form>
    </details>
  );
}
