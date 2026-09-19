import { Link } from 'react-router-dom';
import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  graphLd,
} from '../components/seo/SeoHead';
import { SITE } from '../lib/site';

const UPDATED = '18 de septiembre de 2026';

export default function TermsPage() {
  return (
    <MarketingShell>
      <SeoHead
        title="Términos y condiciones"
        description={`Términos de uso de Matu AI SaaS, servicio de ${SITE.companyName} (Matubyte). Cuenta, planes, uso aceptable y responsabilidad.`}
        path="/terminos"
        jsonLd={graphLd(
          buildOrganizationLd(),
          buildBreadcrumbLd([
            { name: 'Inicio', path: '/' },
            { name: 'Términos', path: '/terminos' },
          ])
        )}
      />

      <main className="px-4 py-10 sm:px-6 md:px-10 md:py-14">
        <div className="card card-bone prose-legal border-[2.5px] border-black shadow-[5px_5px_0_#000]">
          <p className="mono opacity-60">Legal · Actualizado {UPDATED}</p>
          <h1 className="legal-title">Términos</h1>
          <p>
            Estos términos regulan el acceso a <strong>Matu AI SaaS</strong>{' '}
            (“Servicio”), operado por <strong>{SITE.companyName}</strong>{' '}
            (“Matubyte”, “nosotros”). Al crear una cuenta o usar el Servicio,
            aceptas estos términos y la{' '}
            <Link to="/privacidad">Política de privacidad</Link>.
          </p>

          <h2>1. El Servicio</h2>
          <p>
            Matu AI es una plataforma de chat con modelos de inteligencia
            artificial (generales y sectorizados), proyectos, herramientas de
            formato (tablas, exports, previews) y funciones relacionadas. El
            Servicio puede evolucionar; podemos añadir, modificar o retirar
            funciones con aviso razonable cuando el cambio sea material.
          </p>

          <h2>2. Cuenta</h2>
          <ul>
            <li>Debes proporcionar información veraz y mantenerla actualizada.</li>
            <li>Eres responsable de la confidencialidad de tus credenciales.</li>
            <li>
              Debes tener capacidad legal para contratar en tu jurisdicción
              (Colombia u otra aplicable).
            </li>
          </ul>

          <h2>3. Planes y pagos</h2>
          <p>
            Ofrecemos un plan gratuito con límites (mensajes, tokens,
            conversaciones) y planes de pago (p. ej. Pro y Team) con precios
            publicados en el Sitio. Los límites pueden cambiar; el uso que
            exceda el plan puede bloquearse o requerir upgrade. Los cargos de
            planes de pago, impuestos y renovaciones se rigen por el checkout o
            factura aplicable.
          </p>

          <h2>4. Uso aceptable</h2>
          <p>No puedes usar el Servicio para:</p>
          <ul>
            <li>Actividades ilegales, fraude, malware o abuso de terceros.</li>
            <li>
              Intentar vulnerar seguridad, scrapear de forma abusiva o eludir
              límites de plan.
            </li>
            <li>
              Generar contenido que infrinja derechos de autor, privacidad o
              leyes aplicables de forma deliberada.
            </li>
            <li>
              Presentar las salidas del modelo como asesoría profesional
              certificada (legal, médica, financiera) sin revisión humana.
            </li>
          </ul>

          <h2>5. Contenido e IA</h2>
          <p>
            Conservas derechos sobre el contenido que envías, en la medida que
            la ley lo permita. Nos otorgas licencia para procesarlo y
            almacenarlo solo para operar el Servicio. Las respuestas son
            generadas por modelos y pueden contener errores: debes verificar
            información crítica antes de usarla en producción o con clientes.
          </p>

          <h2>6. Propiedad intelectual</h2>
          <p>
            Matu AI, Matubyte, {SITE.companyName}, marcas, diseño y software del
            Servicio son propiedad de {SITE.companyName} o sus licenciantes. No
            se concede licencia distinta a la de uso del Servicio conforme a
            estos términos.
          </p>

          <h2>7. Disponibilidad</h2>
          <p>
            Buscamos alta disponibilidad, pero no garantizamos uptime
            ininterrumpido. Podemos realizar mantenimientos. No somos
            responsables por interrupciones de proveedores upstream de modelos
            o red fuera de nuestro control razonable.
          </p>

          <h2>8. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por la ley colombiana,{' '}
            {SITE.companyName} no será responsable por daños indirectos,
            lucro cesante o pérdida de datos derivados del uso del Servicio. La
            responsabilidad agregada, si existiera, se limita a lo pagado por el
            Servicio en los tres (3) meses previos al reclamo (o cero si usas
            solo el plan gratuito).
          </p>

          <h2>9. Suspensión y terminación</h2>
          <p>
            Podemos suspender o cerrar cuentas por incumplimiento, abuso o
            riesgo de seguridad. Puedes dejar de usar el Servicio en cualquier
            momento. Tras el cierre, podemos eliminar datos según la política
            de retención.
          </p>

          <h2>10. Ley aplicable</h2>
          <p>
            Estos términos se rigen por las leyes de la República de Colombia.
            Cualquier disputa se someterá a los jueces competentes de Colombia,
            sin perjuicio de derechos imperativos del consumidor.
          </p>

          <h2>11. Contacto</h2>
          <p>
            {SITE.companyName} · {SITE.email} ·{' '}
            <a href={`https://${SITE.domain}`} target="_blank" rel="noreferrer">
              {SITE.domain}
            </a>
          </p>
        </div>
      </main>
    </MarketingShell>
  );
}
