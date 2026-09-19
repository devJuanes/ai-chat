import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Google Analytics 4 via gtag.js
 * Set VITE_GA_MEASUREMENT_ID=G-XXXXXXXX in .env
 * (el usuario puede pegar su Measurement ID de GA4)
 */
export default function GoogleAnalytics() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  const location = useLocation();

  useEffect(() => {
    if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return;
    if (window.__MATU_GA_LOADED__) return;
    window.__MATU_GA_LOADED__ = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id, {
      anonymize_ip: true,
      send_page_view: false,
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }, [id]);

  useEffect(() => {
    if (!id || typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [id, location.pathname, location.search]);

  return null;
}
