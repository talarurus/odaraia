// SPDX-License-Identifier: MPL-2.0
// Presentation identity only. Storage keys, API headers and backup formats stay stable.
export const productIdentity = Object.freeze({
  name: 'Odaraia',
  category: 'Personal finance',
  publisher: 'Talarurus',
  version: '0.3.1',
  bundleIdentifier: 'com.talarurus.odaraia',
  dataIdentifier: 'com.talarurus.odaraia',
  workingMark: 'temporary-ledger',
  markDirectory: 'placeholder',
  markStatus: 'Temporary neutral placeholder; final identity pending',
  description: 'A calm, clear view of your accounts, spending and financial progress.',
  downloads: Object.freeze({transactions: 'odaraia-transactions.csv', backup: 'odaraia-backup.json'}),
  icon: '/assets/brand/odaraia-favicon.svg',
  symbol: '/assets/brand/odaraia-symbol.svg',
  publisherLogos: Object.freeze({
    light: '/assets/brand/publisher/talarurus-horizontal.svg',
    dark: '/assets/brand/publisher/talarurus-horizontal-white.svg'
  })
});
export const pageTitle = page => page ? `${page} · ${productIdentity.name}` : productIdentity.name;
// Explicit static allowlist shared by the build and local HTTP server.
export const publicAssets = Object.freeze([
  productIdentity.icon, productIdentity.symbol, productIdentity.publisherLogos.light, productIdentity.publisherLogos.dark
].map(url => Object.freeze({url, file: url.slice('/assets/'.length), type: 'image/svg+xml'})));
