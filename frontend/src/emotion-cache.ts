import createCache from '@emotion/cache';

export function createApplicationEmotionCache(doc: Document = document) {
  const nonce = doc.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content || undefined;

  return createCache({
    key: 'voip-monitor',
    ...(nonce ? { nonce } : {}),
  });
}
