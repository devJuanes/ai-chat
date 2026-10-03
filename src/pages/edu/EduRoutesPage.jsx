import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import EduPending from './EduPending';
import EduCover from './EduCover';

export default function EduRoutesPage() {
  const auth = useAuth();
  const [courses, setCourses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop = false;
    Promise.all([
      api('/api/edu/courses', { token: auth.getToken() }),
      api('/api/edu/subscriptions', { token: auth.getToken() }).catch(() => ({ courses: [] })),
    ])
      .then(([mine, shared]) => {
        if (stop) return;
        setCourses(mine.courses || []);
        setSubscriptions(shared.courses || []);
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No pude cargar tus rutas');
      })
      .finally(() => {
        if (!stop) setReady(true);
      });
    return () => {
      stop = true;
    };
  }, [auth]);

  if (!ready) return <EduPending />;

  const empty = courses.length === 0 && subscriptions.length === 0;

  return (
    <div className={empty ? 'edu-home edu-routes-empty' : 'edu-home'}>
      {empty ? (
        <>
          <p className="edu-home-hello">Tu progreso</p>
          <h1 className="edu-home-title">Mis rutas</h1>
          {error ? <div className="edu-error">{error}</div> : null}
          <div className="edu-empty-panel">
            <strong>Todavía no tienes un curso.</strong>
            <p>Cuando lo crees, queda aquí con su portada y el porcentaje que llevas.</p>
            <Link className="edu-btn" to="/edu/crear">
              Crear mi primer curso
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="edu-page-head">
            <div>
              <p className="edu-home-hello">Tu progreso</p>
              <h1 className="edu-home-title">Mis rutas</h1>
            </div>
            <Link className="edu-btn" to="/edu/crear">
              Crear curso
            </Link>
          </div>
          {error ? <div className="edu-error">{error}</div> : null}
          {ready ? (
            <div className="edu-catalog">
              {courses.map((course) => (
                <Link key={course.id} to={`/edu/cursos/${course.id}`} className="edu-catalog-card">
                  <Cover course={course} />
                  <div>
                    <p>Ruta · {course.pct || 0}%</p>
                    <h2>{course.title || course.prompt}</h2>
                    <div className="edu-route-bar">
                      <span style={{ width: `${course.pct || 0}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
          {subscriptions.length ? (
            <>
              <h2 className="edu-live-sub">Suscripciones</h2>
              <div className="edu-catalog">
                {subscriptions.map((course) => (
                  <Link key={course.id} to={`/edu/cursos/${course.id}`} className="edu-catalog-card">
                    <Cover course={course} />
                    <div>
                      <p>Suscripción · {course.pct || 0}%</p>
                      <h2>{course.title || course.prompt}</h2>
                      <div className="edu-route-bar">
                        <span style={{ width: `${course.pct || 0}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Cover({ course }) {
  return <EduCover src={course.cover_url} />;
}
