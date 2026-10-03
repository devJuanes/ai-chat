import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const TOOLS = [
  {
    id: 'ia',
    title: 'Sobre IA',
    lead: 'Cómo funciona un modelo y cómo pedirle algo útil.',
    lessons: [
      {
        title: 'No busca, completa',
        body: 'Un modelo de IA no abre una enciclopedia en el momento. Toma tu mensaje y arma la continuación más probable según lo que vio al entrenarse.',
        example: 'Por eso puede sonar segura y, aun así, inventar una fecha o una cita.',
      },
      {
        title: 'El prompt es la instrucción',
        body: 'Le dices quién responde, qué dato usar y en qué formato lo quieres. Mientras más concreto el pedido, menos relleno.',
        example: '“Explícame el prompt en 5 líneas, con un ejemplo, para alguien que empieza.”',
      },
      {
        title: 'Tú revisas lo que importa',
        body: 'Cifras, nombres, leyes y código que vas a usar se comprueban. La IA sirve para ordenar ideas y practicar, y la decisión queda en ti.',
        example: 'Si el número cambia una compra o una tarea, ábrelo en la fuente.',
      },
      {
        title: 'Tiene un límite',
        body: 'Repite patrones de sus datos, incluidos sesgos. No la uses para decidir por otra persona algo que no puedes revisar.',
        example: 'Un ensayo, un diagnóstico o un contrato no se entregan solo porque “sonó bien”.',
      },
    ],
    questions: [
      {
        q: '¿Qué hace un modelo cuando respondes?',
        options: ['Completa el texto más probable', 'Busca la página en vivo', 'Copia un libro al azar'],
        answer: 0,
        why: 'Arma la continuación probable. No está consultando internet en ese instante.',
      },
      {
        q: '¿Qué es un prompt?',
        options: ['La instrucción que le das', 'El certificado del curso', 'La contraseña de la cuenta'],
        answer: 0,
        why: 'El prompt es el pedido: papel, dato y formato.',
      },
      {
        q: 'Inventa un dato y lo dice con seguridad. Eso es…',
        options: ['Una alucinación', 'Un certificado', 'Un prompt'],
        answer: 0,
        why: 'Alucinación: una respuesta falsa dicha como si fuera cierta.',
      },
      {
        q: '¿Cuándo conviene revisar la respuesta?',
        options: ['Cuando el dato importa', 'Solo si es un poema', 'Nunca, si suena formal'],
        answer: 0,
        why: 'Cifras, citas y código que vas a usar se comprueban.',
      },
      {
        q: 'Un sesgo aparece cuando…',
        options: ['Repite un patrón injusto de los datos', 'El wifi se cae', 'Cierras la pestaña'],
        answer: 0,
        why: 'El modelo puede repetir prejuicios que estaban en el entrenamiento.',
      },
      {
        q: '¿Para qué sirve usarla al estudiar?',
        options: ['Para que te explique y practiques', 'Para entregar su texto como tuyo', 'Para saltarte la revisión'],
        answer: 0,
        why: 'Te explica y te hace practicar. La comprobación sigue siendo tuya.',
      },
    ],
  },
  {
    id: 'programacion',
    title: 'Programación',
    lead: 'Orden, variables, condiciones y funciones.',
    lessons: [
      {
        title: 'Una línea y luego la otra',
        body: 'El programa no adivina el orden. Hace la primera instrucción, después la segunda, y así hasta el final o hasta que una condición lo desvía.',
        example: 'Si primero sumas y después imprimes, ves el resultado. Al revés, imprimes el valor viejo.',
      },
      {
        title: 'La variable guarda un valor',
        body: 'Una variable es un nombre para un dato. Puedes leerlo y puedes cambiarlo. El nombre dice qué guarda, no el tipo de adorno.',
        example: 'edad = 17. Más tarde edad = 18. El nombre sigue, el valor cambió.',
      },
      {
        title: 'La condición elige camino',
        body: 'Si la comparación es cierta, entra a un bloque. Si no, entra al otro. No hace los dos.',
        example: 'Si edad >= 18, “pasa”. Si no, “todavía no”. Con 17 entra al segundo.',
      },
      {
        title: 'La función tiene nombre',
        body: 'Una función junta pasos y les pone un nombre. La llamas cuando los necesitas, en vez de copiarlos otra vez.',
        example: 'saludar(nombre) escribe el saludo. La llamas con “Ana” y con “Luis” sin reescribir el texto.',
      },
    ],
    questions: [
      {
        q: 'Una variable sirve para…',
        options: ['Guardar un valor con un nombre', 'Decorar la pantalla', 'Cerrar el programa'],
        answer: 0,
        why: 'El nombre apunta a un dato que puedes leer y cambiar.',
      },
      {
        q: 'edad vale 17. La condición es edad >= 18. ¿Entra?',
        options: ['No', 'Sí', 'Entra a los dos caminos'],
        answer: 0,
        why: '17 no llega a 18, así que el camino del “sí” no corre.',
      },
      {
        q: 'x = 2 y luego x = x + 3. ¿Cuánto vale x?',
        options: ['5', '2', '23'],
        answer: 0,
        why: 'Toma el 2, le suma 3 y guarda 5 en el mismo nombre.',
      },
      {
        q: '¿Para qué es una función?',
        options: ['Nombrar unos pasos y usarlos otra vez', 'Borrar las variables', 'Pintar el fondo'],
        answer: 0,
        why: 'Agrupa pasos. La llamas por su nombre cuando haga falta.',
      },
      {
        q: 'Un bucle sirve para…',
        options: ['Repetir mientras se cumpla algo', 'Escribir el título una sola vez', 'Apagar el equipo'],
        answer: 0,
        why: 'Repite el bloque hasta que la condición deje de cumplirse.',
      },
      {
        q: 'Falta un signo y el programa no arranca. Eso es…',
        options: ['Un error de sintaxis', 'Una variable', 'Un bucle infinito'],
        answer: 0,
        why: 'Sintaxis: la forma de escribir. Si falta un signo, no se puede leer.',
      },
    ],
  },
];

function toolById(id) {
  return TOOLS.find((item) => item.id === id);
}

export function EduToolsHome() {
  return (
    <div className="edu-home edu-tools">
      <header>
        <p className="edu-home-hello">Herramientas</p>
        <h1 className="edu-home-title">Dos formas de practicar</h1>
        <p className="edu-about-lead">El juego va por un lado. Aprender, con las lecciones, va por otro.</p>
      </header>
      {TOOLS.map((tool) => (
        <section key={tool.id} className="edu-tool-block" aria-label={tool.title}>
          <h2>{tool.title}</h2>
          <p>{tool.lead}</p>
          <div className="edu-tool-modes">
            <Link to={`/edu/herramientas/${tool.id}/jugar`} className="edu-tool-card is-play">
              <strong>Jugar</strong>
              <span>Preguntas, vidas y puntaje.</span>
            </Link>
            <Link to={`/edu/herramientas/${tool.id}/aprender`} className="edu-tool-card is-learn">
              <strong>Aprender</strong>
              <span>Lecciones cortas, una por una.</span>
            </Link>
          </div>
        </section>
      ))}
    </div>
  );
}

function Missing() {
  return (
    <div className="edu-home edu-tools">
      <h1 className="edu-home-title">Esa herramienta no está</h1>
      <Link to="/edu/herramientas" className="edu-btn">
        Ver herramientas
      </Link>
    </div>
  );
}

function Learn({ tool }) {
  const [index, setIndex] = useState(0);
  const lesson = tool.lessons[index];
  const last = index === tool.lessons.length - 1;

  return (
    <div className="edu-home edu-tools edu-learn">
      <Link className="edu-tool-back" to="/edu/herramientas">
        Herramientas
      </Link>
      <p className="edu-home-hello">
        Aprender · {tool.title}
      </p>
      <p className="edu-learn-step">
        Lección {index + 1} de {tool.lessons.length}
      </p>
      <h1 className="edu-home-title">{lesson.title}</h1>
      <p className="edu-about-lead">{lesson.body}</p>
      <p className="edu-learn-example">{lesson.example}</p>
      <div className="edu-learn-nav">
        <button type="button" className="edu-chip" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
          Anterior
        </button>
        {last ? (
          <Link to="/edu/herramientas" className="edu-btn">
            Listo
          </Link>
        ) : (
          <button type="button" className="edu-btn" onClick={() => setIndex((value) => value + 1)}>
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}

function Play({ tool }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [end, setEnd] = useState('');
  const question = tool.questions[index];
  const locked = picked !== null;

  const choose = (option) => {
    if (locked || end) return;
    setPicked(option);
    if (option === question.answer) {
      setScore((value) => value + 10);
      return;
    }
    setLives((value) => value - 1);
  };

  const advance = () => {
    if (lives <= 0) {
      setEnd('vidas');
      return;
    }
    if (index + 1 >= tool.questions.length) {
      setEnd('fin');
      return;
    }
    setIndex((value) => value + 1);
    setPicked(null);
  };

  const again = () => {
    setIndex(0);
    setPicked(null);
    setLives(3);
    setScore(0);
    setEnd('');
  };

  return (
    <div className="edu-home edu-tools edu-play">
      <Link className="edu-tool-back" to="/edu/herramientas">
        Herramientas
      </Link>
      <div className="edu-play-hud">
        <span>Juego · {tool.title}</span>
        <strong>{score} pts</strong>
        <span aria-label={`${lives} vidas`}>{Array.from({ length: 3 }, (_, i) => (i < lives ? '●' : '○')).join(' ')}</span>
      </div>

      {end ? (
        <section className="edu-play-end">
          <h1 className="edu-home-title">{end === 'vidas' ? 'Se acabaron las vidas' : 'Ronda completa'}</h1>
          <p className="edu-about-lead">
            {end === 'vidas'
              ? `Llegaste a ${score} puntos. Puedes volver a intentar la ronda.`
              : `Cerraste las ${tool.questions.length} preguntas con ${score} puntos.`}
          </p>
          <button type="button" className="edu-btn" onClick={again}>
            Jugar otra vez
          </button>
        </section>
      ) : (
        <>
          <p className="edu-learn-step">
            {index + 1} / {tool.questions.length}
          </p>
          <h1 className="edu-play-q">{question.q}</h1>
          <div className="edu-play-options">
            {question.options.map((option, optionIndex) => {
              let mark = '';
              if (locked && optionIndex === question.answer) mark = ' is-good';
              else if (locked && optionIndex === picked) mark = ' is-bad';
              return (
                <button key={option} type="button" className={`edu-play-opt${mark}`} disabled={locked} onClick={() => choose(optionIndex)}>
                  {option}
                </button>
              );
            })}
          </div>
          {locked ? (
            <div className="edu-play-why">
              <p>{question.why}</p>
              <button type="button" className="edu-btn" onClick={advance}>
                {lives <= 0 || index + 1 === tool.questions.length ? 'Ver el resultado' : 'Siguiente'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function EduTool() {
  const { toolId, mode } = useParams();
  const tool = toolById(toolId);
  if (!tool) return <Missing />;
  if (mode === 'jugar') return <Play tool={tool} />;
  if (mode === 'aprender') return <Learn tool={tool} />;
  if (mode) return <Missing />;

  return (
    <div className="edu-home edu-tools">
      <Link className="edu-tool-back" to="/edu/herramientas">
        Herramientas
      </Link>
      <header>
        <p className="edu-home-hello">{tool.title}</p>
        <h1 className="edu-home-title">{tool.lead}</h1>
      </header>
      <div className="edu-tool-modes">
        <Link to={`/edu/herramientas/${tool.id}/jugar`} className="edu-tool-card is-play">
          <strong>Jugar</strong>
          <span>Preguntas, vidas y puntaje.</span>
        </Link>
        <Link to={`/edu/herramientas/${tool.id}/aprender`} className="edu-tool-card is-learn">
          <strong>Aprender</strong>
          <span>Lecciones cortas, una por una.</span>
        </Link>
      </div>
    </div>
  );
}
