import { useEffect } from 'react';
import { SITE, absoluteUrl, defaultDescription } from '../../lib/site';

/**
 * Actualiza title, description, canonical y Open Graph por ruta.
 * Ideal para SPA + SEO básico / sharing.
 */
export default function SeoHead({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  noindex = false,
  jsonLd,
}) {
  const fullTitle = title
    ? `${title} · ${SITE.productName}`
    : `${SITE.productName} — copiloto de negocio by ${SITE.companyShort}`;
  const desc = description || defaultDescription();
  const url = absoluteUrl(path);
  const ogImage = image || absoluteUrl('/og-cover.svg');

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (selector, attr, value) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        if (selector.startsWith('meta[name=')) {
          el.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
        } else if (selector.startsWith('meta[property=')) {
          el.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
        }
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[name="robots"]', 'content', noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
    setMeta('meta[name="author"]', 'content', `${SITE.companyName} · ${SITE.domain}`);
    setMeta('meta[name="application-name"]', 'content', SITE.productName);
    setMeta('meta[name="theme-color"]', 'content', SITE.themeColor);

    setMeta('meta[property="og:title"]', 'content', fullTitle);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:type"]', 'content', type);
    setMeta('meta[property="og:site_name"]', 'content', SITE.productLegal);
    setMeta('meta[property="og:locale"]', 'content', SITE.locale);
    setMeta('meta[property="og:image"]', 'content', ogImage);

    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'content', fullTitle);
    setMeta('meta[name="twitter:description"]', 'content', desc);
    setMeta('meta[name="twitter:image"]', 'content', ogImage);

    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);

    const scriptId = 'matu-jsonld';
    let script = document.getElementById(scriptId);
    if (jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }

    return () => {
      /* leave meta for next route; SeoHead will overwrite */
    };
  }, [fullTitle, desc, url, ogImage, type, noindex, jsonLd]);

  return null;
}

export function buildOrganizationLd() {
  return {
    '@type': 'Organization',
    '@id': absoluteUrl('/#organization'),
    name: SITE.companyName,
    alternateName: [SITE.companyShort, 'Matubyte', 'MatByte', SITE.productLegal],
    url: absoluteUrl('/'),
    logo: absoluteUrl('/favicon.png'),
    email: SITE.email,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CO',
    },
    sameAs: SITE.sameAs,
    founder: {
      '@type': 'Organization',
      name: SITE.companyName,
    },
  };
}

export function buildSoftwareLd() {
  return {
    '@type': 'SoftwareApplication',
    '@id': absoluteUrl('/#software'),
    name: SITE.productName,
    alternateName: [SITE.productLegal, 'Matu', 'MatuAI', 'Matu AI Chat'],
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Artificial Intelligence Chat',
    operatingSystem: 'Web',
    url: absoluteUrl('/'),
    description: defaultDescription(),
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        name: 'Free',
      },
      {
        '@type': 'Offer',
        price: '29',
        priceCurrency: 'USD',
        name: 'Pro',
      },
      {
        '@type': 'Offer',
        price: '99',
        priceCurrency: 'USD',
        name: 'Team',
      },
    ],
    provider: { '@id': absoluteUrl('/#organization') },
    publisher: { '@id': absoluteUrl('/#organization') },
    inLanguage: 'es',
    featureList: [
      'Modelos de IA sectorizados',
      'Chat y proyectos con contexto',
      'Tablas, CSV/Excel y preview HTML',
      'Plan gratis y planes premium económicos',
    ],
  };
}

export function buildWebSiteLd() {
  return {
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    url: absoluteUrl('/'),
    name: SITE.productLegal,
    description: defaultDescription(),
    publisher: { '@id': absoluteUrl('/#organization') },
    inLanguage: 'es-CO',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/explore')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildFaqLd(faq) {
  return {
    '@type': 'FAQPage',
    '@id': absoluteUrl('/#faq'),
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

export function buildBreadcrumbLd(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function graphLd(...nodes) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}
