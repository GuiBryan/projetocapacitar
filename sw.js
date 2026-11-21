/* Service Worker — Controle de Treinamentos IOPS
 *
 * Estrategia:
 *  - O "casco" do app (HTML + icones) é guardado em cache na instalacao.
 *  - O HTML usa network-first: se houver internet, pega a versao nova
 *    (assim uma atualizacao no GitHub chega na proxima abertura);
 *    sem internet, usa a copia em cache e o app abre normalmente.
 *  - NUNCA guardamos em cache as chamadas ao Apps Script: os dados
 *    precisam ser sempre os reais da planilha.
 */

const VERSAO = 'treinamentos-v1';
const CASCO = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(CASCO))
      .catch(() => {}) // se um arquivo faltar, nao impede a instalacao
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;

  // so tratamos GET do nosso proprio dominio
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Apps Script / qualquer outro dominio: deixa passar direto, sem cache.
  if (url.origin !== self.location.origin) return;

  // Navegacao (abrir o app): rede primeiro, cache como reserva.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    evento.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia)).catch(() => {});
          return resp;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('./index.html'))
        )
    );
    return;
  }

  // Demais arquivos do site (icones, manifest): cache primeiro.
  evento.respondWith(
    caches.match(req).then((emCache) => {
      if (emCache) return emCache;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => emCache);
    })
  );
});
