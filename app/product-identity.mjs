// SPDX-License-Identifier: MPL-2.0
// Presentation identity only. Storage keys, API headers and backup formats stay stable.
export const productIdentity = Object.freeze({
  name: 'plainbalance',
  category: 'Personal finance',
  publisher: 'Talarurus',
  version: '0.3.1',
  bundleIdentifier: 'com.talarurus.odaraia',
  dataIdentifier: 'com.talarurus.odaraia',
  workingMark: 'original-corner',
  // Retain the original asset path; the directory name is historical.
  markDirectory: 'placeholder',
  markStatus: 'Founder-preferred original corner; final publication review pending',
  description: 'Local-first personal finance. Accounts, cash flow, spending, budgets, and net worth.',
  downloads: Object.freeze({transactions: 'plainbalance-transactions.csv', backup: 'plainbalance-backup.json'}),
  icon: '/assets/brand/plainbalance-favicon.svg',
  symbol: '/assets/brand/plainbalance-symbol.svg',
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
