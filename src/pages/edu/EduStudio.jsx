import { useEffect, useState } from 'react';

const STEPS = [
  { id: 'investigando', label: 'Buscar fuentes' },
  { id: 'mapa', label: 'Armar el mapa' },
  { id: 'escribiendo', label: 'Escribir lecciones' },
  { id: 'listo', label: 'Abrir el aula' },
];

function stepState(phase, id) {
  const order = ['inicio', 'investigando', 'mapa', 'escribiendo', 'listo'];
  const current = order.indexOf(phase);
  const mine = order.indexOf(id);
  if (phase === 'error') return 'idle';
  if (current > mine) return 'done';
  if (current === mine) return 'on';
  return 'idle';
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)');
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  return narrow;
}

export default function EduStudio({ data, onRetry, onOpen, onDelete }) {
  const course = data.course;
  const building = course.status === 'building';
  const log = Array.isArray(course.log) ? course.log : [];
  const narrow = useNarrow();
  const [logOpen, setLogOpen] = useState(false);
  const shown = narrow && !logOpen ? log.slice(-2) : log;

  return (
    <div className="edu-studio">
      <aside className="edu-studio-log">
        <p className="edu-kicker" style={{ color: '#61609a' }}>
          Creación en vivo
        </p>
        <h1>{course.title || 'Tu curso'}</h1>
        <div className="edu-activity">
          {building ? <i /> : null}
          {course.activity || 'Preparando el aula…'}
        </div>
        <div className="edu-steps">
          {STEPS.map((step) => {
            const state = stepState(course.phase, step.id);
            return (
              <div key={step.id} className={`edu-step ${state}`}>
                <span className="dot" />
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
        {narrow && log.length > 2 ? (
          <button type="button" className="edu-log-toggle" onClick={() => setLogOpen((value) => !value)}>
            {logOpen ? 'Ocultar el registro' : `Ver el registro (${log.length})`}
          </button>
        ) : null}
        <ul className="edu-log">
          {shown.map((line, i) => (
            <li key={`${line.at || i}-${i}`}>{line.text}</li>
          ))}
        </ul>
        {course.status === 'failed' ? (
          <div className="edu-error">
            <strong>Esta parte no se pudo guardar.</strong>
            <p style={{ margin: '6px 0 0' }}>{course.error}</p>
            <p style={{ margin: '6px 0 0' }}>
              Reintentar escribe las lecciones una por una, con el texto para leer.
            </p>
          </div>
        ) : null}
        <div className="edu-row" style={{ marginTop: 16 }}>
          {course.status === 'failed' ? (
            <button type="button" className="edu-btn" onClick={onRetry}>
              Reintentar
            </button>
          ) : null}
          {data.modules.some((mod) => mod.lessons?.length) ? (
            <button type="button" className="edu-btn-ghost" onClick={onOpen}>
              Ver lo que ya está
            </button>
          ) : null}
          <button type="button" className="edu-btn-ghost" onClick={onDelete}>
            Eliminar
          </button>
        </div>
      </aside>
      <section className="edu-stage">
        <div className="edu-stage-head">
          <p className="edu-kicker">Así va quedando</p>
          <h1 className="edu-course-name" style={{ fontSize: 32 }}>
            {course.title || 'Armando el mapa'}
          </h1>
          <p>{course.summary || course.prompt}</p>
        </div>
        {course.sources?.length ? (
          <div className="edu-row" style={{ marginTop: 12 }}>
            {course.sources.slice(0, 3).map((source) => (
              <span key={source.url || source.title} className="edu-badge">
                {source.title}
              </span>
            ))}
          </div>
        ) : null}
        <div className="edu-modules">
          {data.modules.length === 0 ? (
            <article className="edu-module">
              <h2>Módulos</h2>
              <div className="edu-shimmer" />
              <div className="edu-shimmer" style={{ width: '72%' }} />
              <div className="edu-shimmer" style={{ width: '54%' }} />
            </article>
          ) : (
            data.modules.map((mod, index) => {
              const plan = Array.isArray(mod.plan) ? mod.plan : [];
              const rows = mod.lessons?.length
                ? mod.lessons
                : plan.map((title) => ({ title, pending: true }));
              return (
                <article key={mod.id} className="edu-module">
                  <header>
                    <h2>
                      {index + 1}. {mod.title}
                    </h2>
                    <span className={mod.status === 'ready' ? 'edu-badge' : 'edu-badge live'}>
                      {mod.status === 'ready'
                        ? 'Listo'
                        : mod.status === 'writing'
                          ? 'Escribiendo'
                          : 'En cola'}
                    </span>
                  </header>
                  {mod.summary ? (
                    <p style={{ margin: '6px 0 0', color: 'var(--edu-muted)', fontWeight: 600 }}>
                      {mod.summary}
                    </p>
                  ) : null}
                  {rows.map((row, i) =>
                    row.pending ? (
                      <div key={`${mod.id}-p-${i}`}>
                        <div className="edu-lesson-row" style={{ opacity: 0.7 }}>
                          {row.title}
                        </div>
                        {mod.status === 'writing' ? <div className="edu-shimmer" /> : null}
                      </div>
                    ) : (
                      <div key={row.id} className="edu-lesson-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                        <span>
                          <span className="edu-badge">{row.kind === 'quiz' ? 'Quiz' : 'Lección'}</span>{' '}
                          {row.title}
                        </span>
                        {row.body ? (
                          <p className="edu-excerpt">
                            {row.body.replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180)}
                          </p>
                        ) : null}
                      </div>
                    )
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
