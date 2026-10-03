import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { refreshPulse } from './pulse';
import { applyPageTitle } from '../../lib/pageTitle';
import LoadingRing from '../../components/LoadingRing';
import EduStudio from './EduStudio';
import EduPlayer from './EduPlayer';
import PersonFace from './PersonFace';
import CourseRhythm, { rhythmLabel } from './CourseRhythm';

export default function EduCourse() {
  const { courseId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forceStudy, setForceStudy] = useState(false);
  const [review, setReview] = useState(null);
  const [quizNote, setQuizNote] = useState('');

  const load = useCallback(async () => {
    const json = await api(`/api/edu/courses/${courseId}`, { token: auth.getToken() });
    setData(json);
    return json;
  }, [auth, courseId]);

  useEffect(() => {
    applyPageTitle(data?.course?.title || 'Curso', 'EduCreator');
  }, [data?.course?.title]);

  useEffect(() => {
    let stop = false;
    load().catch((err) => {
      if (!stop) setError(err.message || 'No pude abrir el curso');
    });
    return () => {
      stop = true;
    };
  }, [load]);

  useEffect(() => {
    if (data?.course?.status !== 'building') return undefined;
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 1400);
    return () => window.clearInterval(timer);
  }, [data?.course?.status, load]);

  const remove = async () => {
    if (!window.confirm('¿Eliminar este curso?')) return;
    setBusy(true);
    try {
      await api(`/api/edu/courses/${courseId}`, {
        method: 'DELETE',
        token: auth.getToken(),
      });
      navigate('/edu');
    } catch (err) {
      setError(err.message || 'No se pudo eliminar');
      setBusy(false);
    }
  };
  const retry = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/edu/courses/${courseId}/build`, {
        method: 'POST',
        token: auth.getToken(),
      });
      setForceStudy(false);
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo retomar');
    } finally {
      setBusy(false);
    }
  };

  const fill = async (lessonId) => {
    setBusy(true);
    setError('');
    try {
      const json = await api(
        `/api/edu/courses/${courseId}/lessons/${lessonId}/write`,
        { method: 'POST', token: auth.getToken() }
      );
      setData(json);
    } catch (err) {
      setError(err.message || 'No se pudo escribir la lección');
    } finally {
      setBusy(false);
    }
  };

  const select = (id) => {
    setReview(null);
    setQuizNote('');
    const next = new URLSearchParams(params);
    next.set('l', id);
    setParams(next, { replace: true });
  };

  const complete = async (lessonId, nextId) => {
    setBusy(true);
    try {
      const json = await api(
        `/api/edu/courses/${courseId}/lessons/${lessonId}/complete`,
        { method: 'POST', token: auth.getToken() }
      );
      setData(json);
      if (nextId) select(nextId);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el avance');
    } finally {
      setBusy(false);
    }
  };

  const quiz = async (lessonId, answers) => {
    setBusy(true);
    setQuizNote('');
    try {
      const json = await api(
        `/api/edu/courses/${courseId}/lessons/${lessonId}/quiz`,
        { method: 'POST', token: auth.getToken(), body: { answers } }
      );
      setReview(json.review || []);
      setData(json.bundle);
      if (!json.passed) {
        setQuizNote(
          `Te faltó un poco: ${json.score} de ${json.total}. Necesitas ${json.needed}. Puedes volver a intentarlo.`
        );
      }
    } catch (err) {
      setQuizNote(err.message || 'No se pudo revisar el quiz');
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <div className="edu-page">
        <div className="edu-error">{error}</div>
        <Link to="/edu">Volver a cursos</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="edu-fill" style={{ display: 'grid', placeItems: 'center' }}>
        <LoadingRing />
      </div>
    );
  }

  const enroll = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/edu/courses/${courseId}/enroll`, {
        method: 'POST',
        token: auth.getToken(),
      });
      refreshPulse(auth.getToken());
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo inscribir');
    } finally {
      setBusy(false);
    }
  };

  if (data.locked) {
    const price = Number(data.course.price_coins) || 0;
    return (
      <div className="edu-home">
        <p className="edu-home-hello edu-author-inline">
          <PersonFace
            name={data.course.author_name}
            src={data.course.avatar_url}
            href={data.course.user_id ? `/edu/perfil/${data.course.user_id}` : ''}
          />
          {data.course.author_name || 'Curso público'}
        </p>
        <h1 className="edu-home-title">{data.course.title || data.course.prompt}</h1>
        <p className="edu-create-note">{data.course.summary}</p>
        {error ? <div className="edu-error">{error}</div> : null}
        <button type="button" className="edu-btn" disabled={busy} onClick={enroll}>
          {busy ? 'Inscribiendo…' : price ? `Inscribirse · ${price} Edu Coins` : 'Inscribirse'}
        </button>
      </div>
    );
  }

  const studying =
    forceStudy || (data.course.status === 'ready' && data.modules.some((m) => m.lessons?.length));

  if (!studying) {
    return (
      <div className="edu-fill">
        {data.course.mine ? <CourseRhythm course={data.course} onSaved={load} /> : null}
        <EduStudio
          data={data}
          onRetry={retry}
          onOpen={() => setForceStudy(true)}
          onDelete={remove}
        />
      </div>
    );
  }

  return (
    <div className="edu-fill">
      {data.course.mine ? (
        <CourseRhythm course={data.course} onSaved={load} />
      ) : data.course.cadence ? (
        <p className="edu-rhythm-banner">{rhythmLabel(data.course)}. Te avisamos 15 minutos antes.</p>
      ) : null}
      {data.course.status === 'building' ? (
        <div className="edu-row edu-no-print" style={{ padding: '8px 12px', background: '#f4ed36' }}>
          <strong>El curso sigue armándose.</strong>
          <button type="button" className="edu-btn-ghost" onClick={() => setForceStudy(false)}>
            Ver la creación
          </button>
        </div>
      ) : null}
      <EduPlayer
        data={data}
        lessonId={params.get('l')}
        onSelect={select}
        onComplete={complete}
        onQuiz={quiz}
        onAgain={() => {
          setReview(null);
          setQuizNote('');
        }}
        onDelete={remove}
        onFill={fill}
        busy={busy}
        review={review}
        quizNote={quizNote || error}
      />
    </div>
  );
}
