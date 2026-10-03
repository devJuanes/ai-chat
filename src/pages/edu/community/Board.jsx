import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { postAction, useCollection, whenLabel } from './live';
import { LiveState } from './liveui';
import PersonFace from '../PersonFace';
import { shortName } from './format';

function Author({ id, name, avatar }) {
  const label = shortName(name);
  return (
    <span className="edu-author-inline">
      <PersonFace name={label} src={avatar} href={id ? `/edu/perfil/${id}` : ''} />
      {id ? <Link to={`/edu/perfil/${id}`}>{label}</Link> : label}
    </span>
  );
}

function People({ count, label }) {
  return (
    <span>
      {count} {count === 1 ? label : `${label}s`}
    </span>
  );
}

export function CoursesView() {
  const auth = useAuth();
  const { rows, error, ready, setError } = useCollection('/api/edu/public', 'courses');
  const [busy, setBusy] = useState('');
  const [enrolled, setEnrolled] = useState({});

  const enroll = async (course) => {
    setBusy(course.id);
    setError('');
    try {
      await postAction(auth.getToken(), `/api/edu/courses/${course.id}/enroll`);
      setEnrolled((prev) => ({ ...prev, [course.id]: true }));
    } catch (err) {
      setError(err.message || 'No se pudo inscribir');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Cursos públicos</h2>
        <p>Inscríbete y el curso queda en Rutas, dentro de Suscripciones.</p>
      </header>
      <LiveState ready={ready} error={error} empty={rows.length ? '' : 'Todavía no hay cursos públicos.'}>
        <div className="edu-live-list">
          {rows.map((course) => (
            <article key={course.id} className="edu-live-card">
              <div>
                <p className="edu-live-meta">
                  <Author id={course.user_id} name={course.author_name} avatar={course.avatar_url} />
                </p>
                <h2>{course.title || course.prompt}</h2>
                <p>{course.summary}</p>
                <div className="edu-live-actions">
                  {enrolled[course.id] ? (
                    <Link className="edu-btn" to={`/edu/cursos/${course.id}`}>
                      Abrir curso
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="edu-btn"
                      disabled={busy === course.id}
                      onClick={() => enroll(course)}
                    >
                      {busy === course.id
                        ? 'Inscribiendo…'
                        : course.price_coins
                          ? `Inscribirse · ${course.price_coins} Edu Coins`
                          : 'Inscribirse'}
                    </button>
                  )}
                </div>
              </div>
              {course.cover_url ? <img src={course.cover_url} alt="" /> : null}
            </article>
          ))}
        </div>
      </LiveState>
    </section>
  );
}

export function ChallengesView() {
  const auth = useAuth();
  const { rows, error, ready, reload, setError } = useCollection('/api/edu/challenges', 'challenges');
  const [busy, setBusy] = useState('');

  const act = async (id, action) => {
    setBusy(id + action);
    setError('');
    try {
      await postAction(auth.getToken(), `/api/edu/challenges/${id}/${action}`);
      await reload();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el reto');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Retos</h2>
        <p>Los crea un estudiante. Quien se une queda registrado, con inicio, cierre y aviso 15 minutos antes.</p>
      </header>
      <LiveState ready={ready} error={error} empty={rows.length ? '' : 'Todavía no hay retos. Crea el primero.'}>
        <div className="edu-live-list">
          {rows.map((row) => (
            <article key={row.id} className="edu-live-card">
              <div>
                <p className="edu-live-meta">
                  <Author id={row.user_id} name={row.author_name} avatar={row.avatar_url} />
                  {row.tech ? ` · ${row.tech}` : ''} · <People count={row.members} label="persona" />
                </p>
                <h2>{row.title}</h2>
                <p>{row.body}</p>
                <p className="edu-live-meta">
                  {whenLabel(row.starts_at)} — {whenLabel(row.ends_at)}
                </p>
                <div className="edu-live-actions">
                  {row.joined ? (
                    <button
                      type="button"
                      className="edu-btn"
                      disabled={row.done || busy === row.id + 'done'}
                      onClick={() => act(row.id, 'done')}
                    >
                      {row.done ? 'Reto cumplido' : 'Marcar cumplido'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="edu-btn"
                      disabled={busy === row.id + 'join'}
                      onClick={() => act(row.id, 'join')}
                    >
                      Unirme
                    </button>
                  )}
                </div>
              </div>
              {row.image_url ? <img src={row.image_url} alt="" /> : null}
            </article>
          ))}
        </div>
      </LiveState>
    </section>
  );
}

export function ProjectsView() {
  const auth = useAuth();
  const { rows, error, ready, reload, setError } = useCollection('/api/edu/projects', 'projects');
  const [busy, setBusy] = useState('');

  const join = async (id) => {
    setBusy(id);
    setError('');
    try {
      await postAction(auth.getToken(), `/api/edu/projects/${id}/join`);
      await reload();
    } catch (err) {
      setError(err.message || 'No se pudo unir');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Proyectos</h2>
        <p>Un estudiante publica lo que está construyendo y otros pueden sumarse.</p>
      </header>
      <LiveState ready={ready} error={error} empty={rows.length ? '' : 'Todavía no hay proyectos.'}>
        <div className="edu-live-list">
          {rows.map((row) => (
            <article key={row.id} className="edu-live-card">
              <div>
                <p className="edu-live-meta">
                  <Author id={row.user_id} name={row.author_name} avatar={row.avatar_url} />
                  {row.tech ? ` · ${row.tech}` : ''} · <People count={row.members} label="persona" />
                </p>
                <h2>{row.title}</h2>
                <p>{row.body}</p>
                <div className="edu-live-actions">
                  {row.link ? (
                    <a className="edu-btn-ghost" href={row.link} target="_blank" rel="noreferrer">
                      Abrir enlace
                    </a>
                  ) : null}
                  {row.joined ? (
                    <span className="edu-cm-resolved">Estás dentro</span>
                  ) : (
                    <button type="button" className="edu-btn" disabled={busy === row.id} onClick={() => join(row.id)}>
                      Unirme
                    </button>
                  )}
                </div>
              </div>
              {row.image_url ? <img src={row.image_url} alt="" /> : null}
            </article>
          ))}
        </div>
      </LiveState>
    </section>
  );
}

export function GroupsView() {
  const [params] = useSearchParams();
  const mineOnly = params.get('mios') === '1';
  const { rows, error, ready } = useCollection('/api/edu/groups', 'groups');
  const shown = mineOnly ? rows.filter((row) => row.joined) : rows;

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>{mineOnly ? 'Mis grupos' : 'Grupos'}</h2>
        <p>Un grupo de estudio puede tener varios cursos. El enlace invita a quien todavía no tiene cuenta.</p>
      </header>
      <LiveState ready={ready} error={error} empty={shown.length ? '' : 'Todavía no hay grupos aquí.'}>
        <div className="edu-live-list">
          {shown.map((row) => (
            <article key={row.id} className="edu-live-card">
              <div>
                <p className="edu-live-meta">
                  <Author id={row.user_id} name={row.author_name} avatar={row.avatar_url} /> · <People count={row.members} label="persona" />
                </p>
                <h2>{row.title}</h2>
                <p>{row.body}</p>
                {row.starts_at ? <p className="edu-live-meta">Sesión {whenLabel(row.starts_at)}</p> : null}
                <div className="edu-live-actions">
                  <Link className="edu-btn" to={`/edu/comunidad/grupos/${row.id}`}>
                    {row.joined ? 'Abrir' : 'Ver grupo'}
                  </Link>
                </div>
              </div>
              {row.image_url ? <img src={row.image_url} alt="" /> : null}
            </article>
          ))}
        </div>
      </LiveState>
    </section>
  );
}

export function GroupDetail() {
  const { groupId } = useParams();
  const auth = useAuth();
  const { extra, error, ready, reload, setError } = useCollection(`/api/edu/groups/${groupId}`, 'group');
  const group = extra.group;
  const [busy, setBusy] = useState(false);
  const link = group?.invite_path ? `${window.location.origin}${group.invite_path}` : '';

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      await postAction(auth.getToken(), '/api/edu/groups/join', { group_id: groupId });
      await reload();
    } catch (err) {
      setError(err.message || 'No se pudo unir');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setError('No pude copiar el enlace');
    }
  };

  return (
    <section className="edu-live">
      <LiveState ready={ready} error={error && !group ? error : ''} empty={!group && ready ? 'Ese grupo no está.' : ''}>
        {group ? (
          <>
            <header className="edu-live-head">
              <h2>{group.title}</h2>
              <p>{group.body}</p>
            </header>
            {error ? <div className="edu-error">{error}</div> : null}
            <div className="edu-live-actions">
              {group.joined ? (
                <Link className="edu-btn" to={`/edu/crear?grupo=${group.id}`}>
                  Crear curso del grupo
                </Link>
              ) : (
                <button type="button" className="edu-btn" disabled={busy} onClick={join}>
                  Unirme al grupo
                </button>
              )}
              {link ? (
                <button type="button" className="edu-btn-ghost" onClick={copy}>
                  Copiar invitación
                </button>
              ) : null}
            </div>
            {group.joined ? (
              <>
                <h3 className="edu-live-sub">Cursos del grupo</h3>
                <div className="edu-live-list">
                  {(group.courses || []).length ? (
                    group.courses.map((course) => (
                      <article key={course.id} className="edu-live-card">
                        <div>
                          <h2>{course.title || 'Curso en preparación'}</h2>
                          <p>{course.summary}</p>
                          <Link className="edu-btn" to={`/edu/cursos/${course.id}`}>
                            Abrir
                          </Link>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="edu-live-meta">Este grupo todavía no tiene cursos.</p>
                  )}
                </div>
                <h3 className="edu-live-sub">Personas</h3>
                <ul className="edu-live-people">
                  {(group.people || []).map((person) => (
                    <li key={person.user_id || person.name}>
                      <PersonFace
                        name={person.name}
                        src={person.avatar_url}
                        href={person.user_id ? `/edu/perfil/${person.user_id}` : ''}
                      />
                      {person.user_id ? <Link to={`/edu/perfil/${person.user_id}`}>{shortName(person.name)}</Link> : shortName(person.name)}
                      {person.role === 'owner' ? ' · organiza' : ''}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="edu-live-meta">Únete para ver los cursos y a las personas.</p>
            )}
          </>
        ) : null}
      </LiveState>
    </section>
  );
}

export function JoinGroup() {
  const { code } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    postAction(auth.getToken(), '/api/edu/groups/join', { code })
      .then((json) => {
        if (!stop) navigate(`/edu/comunidad/grupos/${json.id}`, { replace: true });
      })
      .catch((err) => {
        if (!stop) setError(err.message || 'No se pudo entrar al grupo');
      });
    return () => {
      stop = true;
    };
  }, [auth, code, navigate]);

  return (
    <section className="edu-live">
      {error ? <div className="edu-error">{error}</div> : <div className="edu-cm-skel is-tall" />}
    </section>
  );
}

export function EventsView() {
  const auth = useAuth();
  const { rows, error, ready, reload, setError } = useCollection('/api/edu/events', 'events');
  const [busy, setBusy] = useState('');

  const join = async (row) => {
    setBusy(row.id);
    setError('');
    try {
      await postAction(auth.getToken(), `/api/edu/events/${row.id}/join`);
      await reload();
    } catch (err) {
      setError(err.message || 'No se pudo inscribir');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Eventos</h2>
        <p>Los publica el administrador. Al inscribirte recibes ticket, aviso y constancia.</p>
      </header>
      <LiveState ready={ready} error={error} empty={rows.length ? '' : 'Todavía no hay eventos.'}>
        <div className="edu-live-list">
          {rows.map((row) => (
            <article key={row.id} className="edu-live-card">
              <div>
                <p className="edu-live-meta">
                  {whenLabel(row.starts_at)}
                  {row.place ? ` · ${row.place}` : ''} · <People count={row.members} label="inscrito" />
                </p>
                <h2>{row.title}</h2>
                <p>{row.body}</p>
                <div className="edu-live-actions">
                  {row.joined ? (
                    <Link className="edu-btn" to="/edu/eventos">
                      Ver ticket {row.ticket_code}
                    </Link>
                  ) : (
                    <button type="button" className="edu-btn" disabled={busy === row.id} onClick={() => join(row)}>
                      {row.price_coins ? `Inscribirse · ${row.price_coins} Edu Coins` : 'Inscribirse'}
                    </button>
                  )}
                </div>
              </div>
              {row.image_url ? <img src={row.image_url} alt="" /> : null}
            </article>
          ))}
        </div>
      </LiveState>
    </section>
  );
}

export function ActivityView() {
  const { rows, error, ready } = useCollection('/api/edu/activity', 'items');
  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Mi actividad</h2>
        <p>Cursos, retos, proyectos, grupos y eventos en los que estás.</p>
      </header>
      <LiveState ready={ready} error={error} empty={rows.length ? '' : 'Cuando te inscribas, aparece aquí.'}>
        <ul className="edu-live-activity">
          {rows.map((row) => (
            <li key={row.id}>
              <span>{row.kind}</span>
              <Link to={row.href}>{row.title}</Link>
              <time>{row.at ? whenLabel(row.at) : ''}</time>
            </li>
          ))}
        </ul>
      </LiveState>
    </section>
  );
}

export function CalendarView() {
  const { rows, error, ready } = useCollection('/api/edu/calendar', 'items');
  const [cursor, setCursor] = useState(() => new Date());
  const [picked, setPicked] = useState('');

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

  const keyOf = (date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(date);

  const byDay = useMemo(() => {
    const map = {};
    for (const item of rows) {
      const key = keyOf(new Date(item.starts_at));
      map[key] = map[key] || [];
      map[key].push(item);
    }
    return map;
  }, [rows]);

  const selected = picked || keyOf(new Date());
  const title = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(cursor);

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Calendario</h2>
        <p>Retos, sesiones de grupo y eventos. El aviso llega 15 minutos antes, también por correo.</p>
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
        <div className="edu-cal">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
            <span key={label} className="edu-cal-label">
              {label}
            </span>
          ))}
          {days.map((day) => {
            const key = keyOf(day);
            const on = day.getMonth() === cursor.getMonth();
            return (
              <button
                key={key + day.getDate()}
                type="button"
                className={`edu-cal-day${on ? '' : ' is-out'}${key === selected ? ' is-on' : ''}`}
                onClick={() => setPicked(key)}
              >
                {day.getDate()}
                {byDay[key]?.length ? <i /> : null}
              </button>
            );
          })}
        </div>
        <ul className="edu-live-activity">
          {(byDay[selected] || []).length ? (
            byDay[selected].map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <span>{item.kind}</span>
                <Link to={item.href}>{item.title}</Link>
                <time>
                  {whenLabel(item.starts_at)} — {whenLabel(item.ends_at)}
                </time>
              </li>
            ))
          ) : (
            <li>
              <span>Día libre</span>
              <strong>Nada registrado este día.</strong>
            </li>
          )}
        </ul>
      </LiveState>
    </section>
  );
}

export function StreaksView() {
  const { extra, error, ready } = useCollection('/api/edu/streaks', 'board');
  const board = extra.board || [];
  const mine = extra.mine;

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Rachas</h2>
        <p>Sube cuando terminas una lección en el día. Si pasa un día sin estudiar, vuelve a cero.</p>
      </header>
      <LiveState ready={ready} error={error} empty="">
        <p className="edu-live-meta">
          Tu racha: {mine?.current || 0} días · mejor {mine?.best || 0}
        </p>
        {board.length ? (
          <>
            <ol className="edu-streak-podium">
              {[board[1], board[0], board[2]].filter(Boolean).map((row) => {
                const place = board.indexOf(row) + 1;
                return (
                  <li key={row.user_id || row.name} className={place === 1 ? 'is-first' : undefined}>
                    <span>{place}</span>
                    <PersonFace
                      name={row.name}
                      src={row.avatar_url}
                      href={row.user_id ? `/edu/perfil/${row.user_id}` : ''}
                    />
                    <strong>{shortName(row.name)}</strong>
                    <em>{row.current} días</em>
                  </li>
                );
              })}
            </ol>
            {board.length > 3 ? (
              <ol className="edu-live-rank">
                {board.slice(3).map((row, index) => (
                  <li key={row.user_id || `${row.name}-${index}`} className={row.mine ? 'is-mine' : undefined}>
                    <span>{index + 4}</span>
                    <strong className="edu-rank-who">
                      <PersonFace
                        name={row.name}
                        src={row.avatar_url}
                        href={row.user_id ? `/edu/perfil/${row.user_id}` : ''}
                      />
                      {row.user_id ? <Link to={`/edu/perfil/${row.user_id}`}>{shortName(row.name)}</Link> : shortName(row.name)}
                    </strong>
                    <em>{row.current} días</em>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ) : (
          <p className="edu-live-meta">Todavía no hay rachas. Termina una lección hoy.</p>
        )}
      </LiveState>
    </section>
  );
}

export function TicketsView() {
  const auth = useAuth();
  const { rows, error, ready, setError } = useCollection('/api/edu/tickets', 'tickets');
  const [cert, setCert] = useState(null);
  const [busy, setBusy] = useState('');

  const openCert = async (row) => {
    setBusy(row.event_id);
    setError('');
    try {
      const json = await api(`/api/edu/events/${row.event_id}/certificate`, {
        method: 'POST',
        token: auth.getToken(),
      });
      setCert(json.certificate);
    } catch (err) {
      setError(err.message || 'La constancia todavía no está');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="edu-live">
      <header className="edu-live-head">
        <h2>Tus tickets</h2>
        <p>Cada evento deja un código y, cuando empieza, la constancia de que estuviste.</p>
      </header>
      <LiveState ready={ready} error={error} empty={rows.length ? '' : 'Todavía no tienes un ticket.'}>
        <div className="edu-live-list">
          {rows.map((row) => (
            <article key={row.id} className="edu-live-card edu-live-ticket">
              <div>
                <p className="edu-live-meta">{whenLabel(row.starts_at)}{row.place ? ` · ${row.place}` : ''}</p>
                <h2>{row.title}</h2>
                <p className="edu-ticket-code">{row.ticket_code}</p>
                {row.certificate ? (
                  <button type="button" className="edu-btn" disabled={busy === row.event_id} onClick={() => openCert(row)}>
                    Ver constancia
                  </button>
                ) : (
                  <p className="edu-live-meta">La constancia se abre cuando el evento empiece.</p>
                )}
              </div>
            </article>
          ))}
        </div>
        {cert ? (
          <article className="edu-live-card">
            <div>
              <p className="edu-live-meta">Constancia de asistencia</p>
              <h2>{cert.title}</h2>
              <p>{cert.learner_name}</p>
              <p className="edu-ticket-code">{cert.code}</p>
            </div>
          </article>
        ) : null}
      </LiveState>
    </section>
  );
}
