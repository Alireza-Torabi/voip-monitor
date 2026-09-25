import { defineConfig, type ProxyOptions } from 'vite';

// Development only: preserve the browser-facing Host so the backend can enforce Origin == Host.
function localApi(): ProxyOptions {
  return {
    target: 'http://127.0.0.1:3000',
    changeOrigin: false,
    configure(proxy) {
      proxy.on('proxyReq', (proxyRequest, browserRequest) => {
        if (browserRequest.headers.host)
          proxyRequest.setHeader('host', browserRequest.headers.host);
      });
    },
  };
}
export default defineConfig({
  server: { proxy: { '/setup': localApi(), '/auth': localApi(), '/api': localApi() } },
});
