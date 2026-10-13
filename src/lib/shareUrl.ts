let appBaseUrl: string | null = null;

export const setAppBaseUrl = (url: string): void => {
  appBaseUrl = url;
};

export const getAppBaseUrl = (): string => {
  if (appBaseUrl) return appBaseUrl;
  if (typeof window !== 'undefined') {
    const raw = window.location.href.split('#')[0];
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }
  // Fallback for SSR / Node.js testing
  return 'http://localhost';
};

export const getEventUrl = (slugOrId: string): string =>
  `${getAppBaseUrl()}/#/event/${encodeURIComponent(slugOrId)}`;

export const getVerifyUrl = (certificateNo: string): string =>
  `${getAppBaseUrl()}/#/verify?id=${encodeURIComponent(certificateNo)}`;

/**
 * Extract certificate ID from URL query string.
 * Sanitizes input to prevent injection attacks.
 */
export const extractCertId = (queryString: string | null | undefined): string => {
  if (!queryString) return '';
  const params = new URLSearchParams(queryString);
  const id = params.get('id');
  if (!id) return '';
  // Sanitize: only allow alphanumeric, spaces, dashes
  return id.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
};

