import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from './community/live';
import { LiveState } from './community/liveui';
import CourseRhythm, { rhythmLabel } from './CourseRhythm';

const KIND = {
  evento: 'Evento',
  curso: 'Curso',
  leccion: 'Lección',
  reto: 'Reto',
  grupo: 'Grupo',
};

function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(date);
}

function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(date);
}

export default function EduCalendar() {
  const { rows, extra, error, ready, reload } = useCollection('/api/edu/calendar', 'items');
  const [cursor, setCursor] = useState(() => new Date());
  const [picked, setPicked] = useState('');
  const plans = extra.plans || [];

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = {};
    for (const item of rows) {
      const key = dayKey(new Date(item.starts_at));
      map[key] = map[key] || [];
      map[key].push(item);
    }
    return map;
  }, [rows]);

  const selected = picked || dayKey(new Date());
  const title = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(cursor);
  const agenda = byDay[selected] || [];

  return (
    <div className="edu-home edu-agenda">
      <header>
        <p className="edu-home-hello">Calendario y eventos</p>
        <h1 className="edu-home-title">Tu calendario</h1>
        <p className="edu-about-lead">
          Aquí quedan los eventos a los que te inscribes, las clases de tus cursos y las lecciones que ya terminaste.
          El correo llega 15 minutos antes de cada clase.
        </p>
      </header>

      <LiveState ready={ready} error={error} empty="">
        <div className="edu-cal-bar">
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            Anterior
          </button>
          <strong>{title}</strong>
          <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            Siguiente
          </button>
        </div>
        <div className="edu-cal" role="grid" aria-label={title}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
            <span key={label} className="edu-cal-label">
              {label}
            </span>
          ))}
          {days.map((day) => {
            const key = dayKey(day);
            const count = byDay[key]?.length || 0;
            return (
              <button
                key={key}
                type="button"
                className={`edu-cal-day${day.getMonth() === cursor.getMonth() ? '' : ' is-out'}${key === selected ? ' is-on' : ''}`}
                onClick={() => setPicked(key)}
              >
                {day.getDate()}
                {count ? <i>{count}</i> : null}
              </button>
            );
          })}
        </div>

        <section className="edu-agenda-day" aria-label="Día elegido">
          <h2>{selected}</h2>
          {agenda.length ? (
            <ul>
              {agenda.map((item) => (
                <li key={`${item.kind}-${item.id}`} className={`is-${item.kind}`}>
                  <span>{KIND[item.kind] || item.kind}</span>
                  <Link to={item.href}>{item.title}</Link>
                  <time>{clock(item.starts_at)}{item.ends_at && item.ends_at !== item.starts_at ? ` – ${clock(item.ends_at)}` : ''}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nada este día. Si te inscribes a un evento o fijas un horario de curso, aparece aquí.</p>
          )}
        </section>
      </LiveState>

      <section className="edu-agenda-plans" aria-label="Horario de tus cursos">
        <h2>Horario de tus cursos</h2>
        <p>Si pones todos los días a una hora, esa clase sale cada día en el calendario.</p>
        {plans.length ? (
          plans.map((plan) => (
            <article key={plan.id}>
              <header>
                <Link to={plan.href}>{plan.title}</Link>
                <small>{rhythmLabel(plan)}</small>
              </header>
              <CourseRhythm course={plan} onSaved={reload} />
            </article>
          ))
        ) : (
          <p>Cuando crees un curso, puedes fijar aquí su constancia.</p>
        )}
      </section>
    </div>
  );
}
