import MarketingShell from '../components/marketing/MarketingShell';
import SeoHead, {
  buildBreadcrumbLd,
  buildOrganizationLd,
  graphLd,
} from '../components/seo/SeoHead';
import { SITE } from '../lib/site';

const UPDATED = '18 de septiembre de 2026';

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <SeoHead
        title="Política de privacidad"
        description={`Política de privacidad de Matu AI SaaS, producto de ${SITE.companyName}. Cómo tratamos datos de cuenta, chats y uso.`}
        path="/privacidad"
        jsonLd={graphLd(
          buildOrganizationLd(),
          buildBreadcrumbLd([
            { name: 'Inicio', path: '/' },
            { name: 'Privacidad', path: '/privacidad' },
          ])
        )}
      />

      <main className="px-4 py-10 sm:px-6 md:px-10 md:py-14">
        <div className="card card-bone prose-legal border-[2.5px] border-black shadow-[5px_5px_0_#000]">
          <p className="mono opacity-60">Legal · Actualizado {UPDATED}</p>
          <h1 className="legal-title">Privacidad</h1>
          <p>
            Esta política describe cómo <strong>{SITE.companyName}</strong>{' '}
            (“Matubyte”, “nosotros”) trata datos personales al usar{' '}
            <strong>Matu AI SaaS</strong> (“Matu AI”, “el Servicio”), disponible
            a través de {SITE.domain} y dominios relacionados.
          </p>

          <h2>1. Responsable</h2>
          <p>
            Responsable del tratamiento: {SITE.companyName}, {SITE.companyCountry}.
            Contacto: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>

          <h2>2. Datos que tratamos</h2>
          <ul>
            <li>
              <strong>Cuenta:</strong> nombre, correo, credenciales de acceso y
              datos de organización/plan.
            </li>
            <li>
              <strong>Uso del producto:</strong> mensajes, conversaciones,
              proyectos, modelos seleccionados, metadatos técnicos (IP
              aproximada, dispositivo, logs) y métricas de consumo (mensajes,
              tokens).
            </li>
            <li>
              <strong>Pagos (si aplica):</strong> información de facturación
              procesada por proveedores de pago; no almacenamos números
              completos de tarjeta en nuestros servidores de aplicación.
            </li>
            <li>
              <strong>Analítica web:</strong> si activamos Google Analytics u
              herramientas similares, datos agregados de navegación según tu
              consentimiento y configuración.
            </li>
          </ul>

          <h2>3. Finalidades</h2>
          <ul>
            <li>Proveer y mejorar el chat, modelos y funciones del Servicio.</li>
            <li>Autenticación, seguridad, prevención de abuso y soporte.</li>
            <li>Facturación, límites de plan y comunicaciones operativas.</li>
            <li>Cumplir obligaciones legales aplicables en Colombia.</li>
          </ul>

          <h2>4. Base y conservación</h2>
          <p>
            Tratamos datos para ejecutar el contrato del Servicio, interés
            legítimo de seguridad/mejora y, cuando corresponda, consentimiento.
            Conservamos la información mientras la cuenta esté activa y por
            plazos adicionales exigidos por ley o defensa de reclamos.
          </p>

          <h2>5. Encargados y transferencias</h2>
          <p>
            Podemos usar infraestructura de nube, bases de datos (p. ej.
            MatuDB), proveedores de modelos upstream y herramientas de email o
            analítica. Cuando hay transferencia internacional, aplicamos
            salvaguardas razonables disponibles en el mercado.
          </p>

          <h2>6. Contenido de los chats</h2>
          <p>
            El contenido que envías puede procesarse para generar respuestas.
            No vendemos tus conversaciones. Evita incluir secretos innecesarios
            (claves API, datos de salud o financieros sensibles) en el chat.
          </p>

          <h2>7. Tus derechos</h2>
          <p>
            Puedes solicitar acceso, actualización, eliminación o limitación
            del tratamiento escribiendo a{' '}
            <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>,
            sujeto a verificación de identidad y excepciones legales.
          </p>

          <h2>8. Cookies</h2>
          <p>
            Usamos cookies o almacenamiento local necesarios para sesión y
            preferencias. Las cookies de medición (p. ej. Analytics) se usan
            cuando están configuradas en el despliegue.
          </p>

          <h2>9. Cambios</h2>
          <p>
            Podemos actualizar esta política. Publicaremos la fecha de revisión
            en esta página. El uso continuado del Servicio implica conocimiento
            de la versión vigente.
          </p>

          <h2>10. Contacto</h2>
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
