import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';

const LEVELS = [
  { id: 'inicial', label: 'Desde cero' },
  { id: 'intermedio', label: 'Ya tengo bases' },
  { id: 'avanzado', label: 'Quiero profundidad' },
];

const STEPS = ['Tu nivel', 'Público', 'El tema'];

export default function EduCreate() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState(params.get('tema') || '');
  const [level, setLevel] = useState('inicial');
  const [publicCourse, setPublicCourse] = useState(Boolean(params.get('grupo')));
  const [price, setPrice] = useState('0');
  const groupId = params.get('grupo') || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async (event) => {
    event.preventDefault();
    const text = prompt.trim();
    if (text.length < 8 || busy) return;
    setBusy(true);
    setError('');
    try {
      const json = await api('/api/edu/courses', {
        method: 'POST',
        token: auth.getToken(),
        body: {
          prompt: text,
          level,
          is_public: publicCourse || Boolean(groupId),
          price_coins: publicCourse || groupId ? Number(price) || 0 : 0,
          group_id: groupId,
        },
      });
      navigate(`/edu/cursos/${json.course.id}`);
    } catch (err) {
      setError(err.message || 'No se pudo empezar el curso');
      setBusy(false);
    }
  };

  return (
    <div className="edu-home edu-create-flow">
      <form className="edu-create-card" onSubmit={create}>
        <p className="edu-create-kicker">
          Paso {step + 1} de {STEPS.length}
        </p>
        <div className="edu-create-steps" aria-hidden="true">
          {STEPS.map((label, index) => (
            <span key={label} className={index <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 ? (
          <>
            <h1 className="edu-home-title">¿Desde dónde partes?</h1>
            <div className="edu-create-choices">
              {LEVELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="edu-chip"
                  aria-pressed={level === item.id}
                  onClick={() => setLevel(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="edu-home-title">¿Lo haces público?</h1>
            <p className="edu-create-note">
              {groupId
                ? 'Este curso queda en tu grupo de estudio.'
                : 'Si dices que sí, otras personas con cuenta pueden estudiarlo y ven tu nombre.'}
            </p>
            <div className="edu-create-choices">
              <button
                type="button"
                className="edu-chip"
                aria-pressed={publicCourse}
                onClick={() => setPublicCourse(true)}
              >
                Sí
              </button>
              <button
                type="button"
                className="edu-chip"
                aria-pressed={!publicCourse}
                onClick={() => setPublicCourse(false)}
              >
                No
              </button>
            </div>
            {publicCourse || groupId ? (
              <label className="edu-create-note">
                Edu Coins para inscribirse (0 si es gratis)
                <input
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  aria-label="Precio en Edu Coins"
                />
              </label>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="edu-home-title">¿Qué quieres aprender?</h1>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Quiero aprender SQL desde cero para filtrar datos de una tabla."
              maxLength={800}
              aria-label="Qué quieres aprender"
            />
          </>
        ) : null}

        {error ? <div className="edu-error">{error}</div> : null}

        <div className="edu-create-nav">
          {step > 0 ? (
            <button type="button" className="edu-chip" onClick={() => setStep((value) => value - 1)}>
              Atrás
            </button>
          ) : null}
          {step < 2 ? (
            <button type="button" className="edu-btn" onClick={() => setStep((value) => value + 1)}>
              Siguiente
            </button>
          ) : (
            <button className="edu-btn edu-create-go" type="submit" disabled={busy || prompt.trim().length < 8}>
              {busy ? 'Abriendo el aula…' : 'Crear curso'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
