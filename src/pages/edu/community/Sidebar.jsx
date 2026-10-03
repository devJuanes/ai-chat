import { Link } from 'react-router-dom';
import { ago, buildActivity, summarizeProgress } from './format';
import { useEduPulse } from '../pulse';
import { useCommunity } from './CommunityContext';
import Icon from './icons';

function Ring({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = 26;
  const turn = 2 * Math.PI * radius;
  const drawn = (pct / 100) * turn;
  return (
    <div className="edu-cm-ring" aria-hidden="true">
      <svg viewBox="0 0 72 72">
        <circle className="track" cx="36" cy="36" r={radius} />
        <circle
          className="value"
          cx="36"
          cy="36"
          r={radius}
          strokeDasharray={`${drawn} ${turn - drawn}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <strong>{pct}%</strong>
    </div>
  );
}

function WidgetHead({ icon, title, to }) {
  const inner = (
    <>
      <span className={`edu-cm-widget-icon is-${icon}`}>
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <Icon name="chevron" />
    </>
  );
  if (!to) return <div className="edu-cm-widget-head">{inner}</div>;
  return (
    <Link className="edu-cm-widget-head" to={to}>
      {inner}
    </Link>
  );
}

export default function Sidebar() {
  const { posts, replies, courses, catalog, certificates, ready } = useCommunity();
  const pulse = useEduPulse();
  const progress = summarizeProgress(courses, certificates);
  const activity = buildActivity(posts, replies, catalog).slice(0, 4);
  const featured = pulse.featured;
  const certLabel = progress.certs
    ? `${progress.certs} ${progress.certs === 1 ? 'certificado' : 'certificados'}`
    : 'Sin certificados';

  return (
    <aside className="edu-cm-side" aria-label="Tu comunidad">
      <section className="edu-cm-widget">
        <WidgetHead icon="chart" title="Mi progreso" to="/edu/rutas" />
        {!ready ? (
          <div className="edu-cm-skel is-line" />
        ) : (
          <>
            <div className="edu-cm-progress">
              <Ring value={progress.pct} />
              <dl className="edu-cm-stats">
                <div>
                  <dt>Avance</dt>
                  <dd>{progress.pct}%</dd>
                </div>
                <div>
                  <dt>Rutas</dt>
                  <dd>{progress.courses}</dd>
                </div>
                <div>
                  <dt>Racha</dt>
                  <dd>{pulse.streak}</dd>
                </div>
              </dl>
            </div>
            <div className="edu-cm-done">
              <div className="edu-route-bar" aria-hidden="true">
                <span style={{ width: `${progress.pct}%` }} />
              </div>
              <div>
                <span>Completado</span>
                <span>{certLabel}</span>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="edu-cm-widget edu-cm-feature">
        <WidgetHead icon="trophy" title="Reto de la semana" to="/edu/comunidad/retos" />
        {featured ? (
          <>
            <strong>{featured.title}</strong>
            <p>{featured.members} {featured.members === 1 ? 'persona dentro' : 'personas dentro'}</p>
            <Link className="edu-cm-reto" to="/edu/comunidad/retos">
              Ver reto
              <Icon name="chevron" />
            </Link>
          </>
        ) : (
          <p className="edu-cm-quiet">Cuando alguien cree un reto, queda aquí.</p>
        )}
      </section>

      <section className="edu-cm-widget">
        <WidgetHead icon="bolt" title="Actividad reciente" to="/edu/comunidad/foro" />
        {!ready ? <div className="edu-cm-skel is-line" /> : null}
        {ready && activity.length === 0 ? (
          <p className="edu-cm-quiet">Cuando alguien publique, la actividad va a aparecer aquí.</p>
        ) : (
          <div className="edu-cm-activity">
            {activity.map((item) => (
              <Link key={item.id} to={item.href}>
                <span className={`edu-cm-act-icon is-${item.tone}`}>
                  <Icon name={item.tone === 'project' ? 'code' : 'chat'} />
                </span>
                <span className="edu-cm-act-copy">
                  <strong>{item.label}</strong>
                  <em>{item.title}</em>
                </span>
                <time>{ago(item.at)}</time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
