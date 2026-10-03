import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import EduPending from './EduPending';
import EduCover from './EduCover';
import PersonFace from './PersonFace';

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Estudiante';
}

export default function EduHome() {
  const auth = useAuth();
  const [courses, setCourses] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const name = firstName(auth.user?.name || auth.user?.email?.split('@')[0]);

  useEffect(() => {
    let stop = false;
    const token = auth.getToken();
    Promise.all([
      api('/api/edu/courses', { token })
        .then((json) => {
          if (!stop) setCourses(json.courses || []);
        })
        .catch((err) => {
          if (!stop) setError(err.message || 'No pude cargar el inicio');
        }),
      api('/api/edu/public', { token })
        .then((json) => {
          if (!stop) setCatalog(json.courses || []);
        })
        .catch(() => {
          if (!stop) setCatalog([]);
        }),
    ]).finally(() => {
      if (!stop) setReady(true);
    });
    return () => {
      stop = true;
    };
  }, [auth]);

  if (!ready) return <EduPending />;

  const mineIds = new Set(courses.map((course) => course.id));
  const community = catalog.filter((course) => !mineIds.has(course.id));
  const pct = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + (course.pct || 0), 0) / courses.length)
    : 0;
  const fan = courses.filter((course) => course.cover_url).slice(0, 3);

  return (
    <div className="edu-home">
      <div className="edu-home-board">
        <header className="edu-home-lead">
          <p className="edu-home-hello">Hola {name}</p>
          <h1 className="edu-home-title">Tienes cursos por continuar</h1>
          {error ? <div className="edu-error">{error}</div> : null}
        </header>

        <div className="edu-home-feature">
          <Link to="/edu/rutas" className="edu-mycard">
            <div className={`edu-fan${fan.length ? '' : ' is-empty'}`}>
              {fan.length ? (
                fan.map((course, index) => (
                  <EduCover
                    key={course.id}
                    className={`edu-fan-card n${index + 1}`}
                    src={course.cover_url}
                  />
                ))
              ) : (
                <div className="edu-fan-empty">Tu primera ruta</div>
              )}
            </div>
            <div className="edu-mycard-body">
              <p>Ruta</p>
              <h2>Mis cursos</h2>
              <div className="edu-route-bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="edu-route-meta">
                <span>
                  {courses.length} {courses.length === 1 ? 'curso' : 'cursos'}
                </span>
                <span>{pct}%</span>
              </div>
            </div>
          </Link>

          {!courses.length ? (
            <Link className="edu-btn edu-home-create" to="/edu/crear">
              Crear curso
            </Link>
          ) : null}
        </div>

        <section className="edu-home-public" aria-label="Cursos públicos">
          <h2 className="edu-home-title edu-home-title-next">Cursos públicos</h2>
          {community.length === 0 ? (
            <p className="edu-home-empty">Cuando alguien publique un curso, va a aparecer aquí.</p>
          ) : (
            <div className="edu-catalog">
              {community.map((course) => (
                <Link key={course.id} to={`/edu/cursos/${course.id}`} className="edu-catalog-card">
                  <EduCover src={course.cover_url} />
                  <div>
                    <p className="edu-author-inline">
                      <PersonFace name={course.author_name} src={course.avatar_url} />
                      {course.author_name ? `Por ${course.author_name}` : 'Público'}
                    </p>
                    <h2>{course.title || 'Curso'}</h2>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
