export const getAppBaseUrl = (): string => {
  const raw = window.location.href.split('#')[0];
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

export const getEventUrl = (slugOrId: string): string =>
  `${getAppBaseUrl()}/#/event/${encodeURIComponent(slugOrId)}`;

export const getVerifyUrl = (certificateNo: string): string =>
  `${getAppBaseUrl()}/#/verify?id=${encodeURIComponent(certificateNo)}`;