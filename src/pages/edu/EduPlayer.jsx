import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RichMarkdown from '../../components/RichMarkdown';
import { courseStats, flatLessons, isModuleOpen } from './courseState';
import { useCourseMenu } from './courseMenu';
import PersonFace from './PersonFace';

function plainTitle(title) {
  return String(title || '').replace(/^m[oó]dulo\s*\d+\s*[:.\-–]\s*/i, '');
}

function dressLesson(markdown, title) {
  let text = String(markdown || '').replace(/\r\n/g, '\n').trim();
  const name = plainTitle(title).trim();
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^#{1,3}\\s*${escaped}\\s*`, 'i'), '').trim();
    text = text.replace(new RegExp(`^\\*{0,2}${escaped}\\*{0,2}\\s*`, 'i'), '').trim();
  }
  text = text.replace(/^\*\*(Paso\s+\d+[^*]*)\*\*/gim, '### $1');
  return fenceBareCode(text);
}

function fenceBareCode(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let buf = [];
  let inFence = false;
  const starts = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\b/i;
  const cont = /^(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|AND|OR|VALUES|SET|HAVING|UNION|INTO)\b/i;
  const flush = () => {
    if (!buf.length) return;
    out.push('```sql', ...buf, '```', '');
    buf = [];
  };
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      flush();
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (starts.test(trimmed) || (buf.length && cont.test(trimmed))) {
      buf.push(line.trimEnd());
      if (/;\s*$/.test(trimmed)) flush();
      continue;
    }
    flush();
    out.push(line);
  }
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function VideoStage({ video, lessonTitle }) {
  const [wide, setWide] = useState(false);
  const youtubeId = /^[a-zA-Z0-9_-]{11}$/.test(video?.youtubeId || '') ? video.youtubeId : '';
  const start = Number(video?.start) > 0 ? Math.floor(Number(video.start)) : 0;

  useEffect(() => {
    setWide(false);
  }, [youtubeId, start]);

  if (!youtubeId) return null;

  return (
    <div className={`edu-screen${wide ? ' wide' : ''}`}>
      <div className="edu-screen-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0${start ? `&start=${start}` : ''}`}
          title={video?.title || lessonTitle || 'Video de la lección'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="edu-screen-bar">
        <span>{video?.title || lessonTitle || 'Video'}</span>
        <button type="button" onClick={() => setWide((value) => !value)}>
          {wide ? 'Cerrar' : 'Ampliar'}
        </button>
      </div>
    </div>
  );
}

function splitLesson(markdown) {
  const text = String(markdown || '').trim();
  const heading = text.search(/\n#{1,3}[^\n]*(práctica|practica|ejercicio)/i);
  const labeled = text.search(/\n(?:ejercicio|práctica|practica)\s*[:.]/i);
  const at = heading >= 0 ? heading : labeled;
  if (at < 40) return { reading: text, practice: '' };
  return { reading: text.slice(0, at).trim(), practice: text.slice(at).trim() };
}

function PracticeBox({ practice, lessonId }) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft('');
  }, [lessonId]);

  if (!practice) return null;

  return (
    <section className="edu-practice">
      <p className="edu-kicker">Práctica</p>
      <div className="edu-prose">
        <RichMarkdown variant="lesson" content={practice.replace(/^#{1,3}\s*/, '## ')} />
      </div>
      <label>
        Escríbelo aquí
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tu consulta, tu código o tu respuesta. Queda en esta lección mientras la tienes abierta."
        />
      </label>
    </section>
  );
}

function ResourceList({ resources }) {
  if (!resources.length) {
    return <p className="edu-lead">Esta lección todavía no tiene recursos aparte del texto.</p>;
  }
  return (
    <div className="edu-resources">
      {resources.map((item, index) => {
        const key = `${item.kind || 'item'}-${item.title || index}`;
        if (item.kind === 'image' && item.url) {
          return (
            <figure key={key} className="edu-resource">
              <img src={item.url} alt={item.title || 'Imagen del curso'} />
              <figcaption>{item.title}</figcaption>
            </figure>
          );
        }
        if (item.kind === 'pdf' && item.url) {
          return (
            <div key={key} className="edu-resource">
              <strong>{item.title}</strong>
              {item.note ? <p>{item.note}</p> : null}
              <iframe title={item.title || 'PDF'} src={item.url} />
            </div>
          );
        }
        if (item.url) {
          return (
            <a key={key} className="edu-resource edu-resource-link" href={item.url} target="_blank" rel="noreferrer">
              <strong>{item.title || 'Recurso'}</strong>
              {item.note ? <span>{item.note}</span> : null}
            </a>
          );
        }
        return (
          <div key={key} className="edu-resource">
            <strong>{item.title || 'Apunte'}</strong>
            {item.note ? <p>{item.note}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function QuizBlock({ lesson, review, onSubmit, onAgain, onContinue, continueLabel, busy }) {
  const [picked, setPicked] = useState([]);
  const questions = review?.length ? review : lesson.quiz?.questions || [];

  return (
    <form
      className="edu-quiz"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(picked);
      }}
    >
      <p>{lesson.body}</p>
      {lesson.quiz ? (
        <p style={{ fontWeight: 700 }}>
          Necesitas {lesson.quiz.pass} de {lesson.quiz.total} para aprobar.
        </p>
      ) : null}
      {questions.map((question, qi) => (
        <fieldset key={question.prompt} className="edu-q">
          <legend style={{ fontWeight: 800 }}>
            {qi + 1}. {question.prompt}
          </legend>
          {(question.choices || []).map((choice, ci) => {
            const revealed = review?.length;
            const cls = revealed
              ? ci === question.answer
                ? 'edu-ok'
                : question.picked === ci
                  ? 'edu-bad'
                  : ''
              : '';
            return (
              <label key={`${qi}-${ci}`} className={cls}>
                <input
                  type="radio"
                  name={`q-${qi}`}
                  disabled={Boolean(revealed) || busy}
                  checked={revealed ? question.picked === ci : picked[qi] === ci}
                  onChange={() => {
                    const next = picked.slice();
                    next[qi] = ci;
                    setPicked(next);
                  }}
                />
                <span>{choice}</span>
              </label>
            );
          })}
          {review?.[qi]?.why ? (
            <p style={{ marginTop: 8, fontWeight: 600 }}>{review[qi].why}</p>
          ) : null}
        </fieldset>
      ))}
      {!review ? (
        <button className="edu-btn" type="submit" disabled={busy}>
          {busy ? 'Revisando…' : 'Enviar quiz'}
        </button>
      ) : (
        <div className="edu-row">
          <p style={{ fontWeight: 800, margin: 0 }}>
            {review.filter((item) => item.ok).length} de {review.length} correctas.
          </p>
          {review.every((item) => item.ok) || review.filter((item) => item.ok).length >= (lesson.quiz?.pass || review.length) ? (
            <button type="button" className="edu-btn" onClick={onContinue}>
              {continueLabel || 'Seguir'}
            </button>
          ) : (
            <button type="button" className="edu-btn-ghost" onClick={onAgain}>
              Intentar de nuevo
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export default function EduPlayer({
  data,
  lessonId,
  onSelect,
  onComplete,
  onQuiz,
  onAgain,
  onDelete,
  onFill,
  busy,
  review,
  quizNote,
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('contenido');
  const courseMenu = useCourseMenu();
  const menu = Boolean(courseMenu?.open);
  const { modules, progress, course } = data;
  const stats = courseStats(modules, progress);
  const lessons = flatLessons(modules);
  const current =
    lessons.find((lesson) => lesson.id === lessonId) ||
    lessons.find((lesson) => !progress[lesson.id]?.completed) ||
    lessons[0];

  const moduleIndex = modules.findIndex((mod) =>
    mod.lessons?.some((lesson) => lesson.id === current?.id)
  );

  const next = useMemo(() => {
    if (!current) return null;
    const index = lessons.findIndex((lesson) => lesson.id === current.id);
    return lessons[index + 1] || null;
  }, [current, lessons]);

  useEffect(() => {
    setTab('contenido');
  }, [current?.id]);

  useEffect(() => {
    if (!courseMenu) return undefined;
    courseMenu.setReady(true);
    return () => {
      courseMenu.setReady(false);
      courseMenu.setOpen(false);
    };
    // El registro dura mientras la lección está abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) {
    return (
      <div className="edu-page">
        <p>Este curso todavía no tiene lecciones.</p>
      </div>
    );
  }

  const done = Boolean(progress[current.id]?.completed);
  const resources = Array.isArray(current.resources) ? current.resources : [];
  const mine = course.mine !== false;
  const hasVideo = /^[a-zA-Z0-9_-]{11}$/.test(current.video?.youtubeId || '');
  const parts = splitLesson(dressLesson(current.body, current.title));

  return (
    <div className="edu-lms edu-watch">
      {menu ? (
        <button
          type="button"
          className="edu-temario-scrim"
          aria-label="Cerrar temario"
          onClick={() => courseMenu?.setOpen(false)}
        />
      ) : null}
      <section className="edu-watch-main">
        {current.kind === 'quiz' ? null : (
          <VideoStage video={current.video} lessonTitle={plainTitle(current.title)} />
        )}
        <div className={`edu-watch-body${hasVideo ? '' : ' edu-reading'}`}>
          <p className="edu-kicker">
            {moduleIndex >= 0
              ? `Módulo ${moduleIndex + 1} · ${plainTitle(modules[moduleIndex].title)}`
              : 'Lección'}
          </p>
          <h2 className="edu-lesson-title">{plainTitle(current.title)}</h2>
          {course.author_name ? (
            <p className="edu-by edu-author-inline">
              <PersonFace
                name={course.author_name}
                src={course.avatar_url}
                href={course.user_id ? `/edu/perfil/${course.user_id}` : ''}
              />
              Creado por {course.author_name}
            </p>
          ) : null}
          {current.kind === 'quiz' ? (
            <QuizBlock
              key={current.id + (review ? '-r' : '')}
              lesson={current}
              review={review}
              busy={busy}
              onSubmit={(answers) => onQuiz(current.id, answers)}
              onAgain={onAgain}
              continueLabel={next ? 'Seguir' : 'Ver certificado'}
              onContinue={() => {
                if (next) onSelect(next.id);
                else navigate(`/edu/cursos/${course.id}/certificado`);
              }}
            />
          ) : (
            <>
              <div className="edu-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'contenido'}
                  className={tab === 'contenido' ? 'on' : ''}
                  onClick={() => setTab('contenido')}
                >
                  Contenido
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'recursos'}
                  className={tab === 'recursos' ? 'on' : ''}
                  onClick={() => setTab('recursos')}
                >
                  Recursos
                </button>
              </div>
              {tab === 'recursos' ? (
                <ResourceList resources={resources} />
              ) : (current.body || '').trim().length < 80 ? (
                <div className="edu-empty">
                  <strong>Esta lección todavía no tiene texto.</strong>
                  <p>Se puede escribir ahora, con ejemplo y un ejercicio para practicar.</p>
                  <button
                    type="button"
                    className="edu-btn"
                    style={{ marginTop: 12 }}
                    disabled={busy}
                    onClick={() => onFill(current.id)}
                  >
                    {busy ? 'Escribiendo…' : 'Escribir la lección'}
                  </button>
                </div>
              ) : (
                <>
                  {!hasVideo ? <p className="edu-read-note">Lectura. Esta lección no tiene un video que hable justo de esto.</p> : null}
                  <div className="edu-prose">
                    <RichMarkdown variant="lesson" content={parts.reading} />
                  </div>
                  <PracticeBox practice={parts.practice} lessonId={current.id} />
                </>
              )}
              <div className="edu-row" style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="edu-btn"
                  disabled={busy}
                  onClick={() => onComplete(current.id, next?.id)}
                >
                  {done ? 'Siguiente' : 'Listo, siguiente'}
                </button>
              </div>
            </>
          )}
          {quizNote ? <div className="edu-error">{quizNote}</div> : null}
        </div>
      </section>
      <aside className={`edu-curriculum${menu ? ' open' : ''}`}>
        <p className="edu-kicker">Tu aula</p>
        <h1 className="edu-course-name">{course.title || 'Curso'}</h1>
        <div className="edu-progress" aria-label={`${stats.pct}% completado`}>
          <span style={{ width: `${stats.pct}%` }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 700 }}>
          {stats.done} de {stats.total} · {stats.pct}%
        </p>
        {modules.map((mod, index) => {
          const open = isModuleOpen(modules, index, progress);
          return (
            <div key={mod.id}>
              <div className="edu-mod-label">Módulo {index + 1}</div>
              <p className="edu-mod-name">{plainTitle(mod.title)}</p>
              {mod.lessons.map((lesson) => {
                const active = lesson.id === current.id;
                const finished = progress[lesson.id]?.completed;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    className={`edu-les${active ? ' on' : ''}${finished ? ' done' : ''}`}
                    disabled={!open}
                    onClick={() => {
                      onSelect(lesson.id);
                      courseMenu?.setOpen(false);
                    }}
                  >
                    {lesson.title}
                    <small>{lesson.kind === 'quiz' ? 'Quiz del módulo' : 'Lección'}</small>
                  </button>
                );
              })}
            </div>
          );
        })}
        <div style={{ marginTop: 16 }} className="edu-row">
          {stats.ready ? (
            <Link className="edu-btn" to={`/edu/cursos/${course.id}/certificado`}>
              Ver certificado
            </Link>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--edu-muted)', fontWeight: 650 }}>
              El certificado se abre cuando termines lecciones y quizzes.
            </p>
          )}
          {mine ? (
            <button type="button" className="edu-btn-ghost" onClick={onDelete}>
              Eliminar
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
