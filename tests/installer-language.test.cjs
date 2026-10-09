const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { supportedLocale, preferredLocale } = require('../electron/language.cjs');

test('locale selection respects user choice, installer choice and system fallback', () => {
  assert.equal(preferredLocale({ locale: 'en' }, { locale: 'es' }, 'es-PE'), 'en');
  assert.equal(preferredLocale(null, { locale: 'es' }, 'en-US'), 'es');
  assert.equal(preferredLocale({ locale: 'de' }, null, 'es-MX'), 'es');
  assert.equal(preferredLocale(null, null, 'fr-FR'), 'en');
});

test('locale normalization never accepts paths, empty values or arbitrary language codes', () => {
  for (const value of [
    '',
    undefined,
    null,
    {},
    'es/../preferences.json',
    'English',
    'pt',
    'ENGLISH',
  ])
    assert.equal(supportedLocale(value), null);
  assert.equal(supportedLocale('ES_pe'), 'es');
  assert.equal(supportedLocale('en-GB'), 'en');
});

test('Windows installer prompts for the two supported languages and persists the selected language', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.build.nsis.displayLanguageSelector, true);
  assert.deepEqual(pkg.build.nsis.installerLanguages, ['es_ES', 'en_US']);
  const script = readFileSync(
    require('node:path').join(__dirname, '../', pkg.build.nsis.include),
    'utf8',
  );
  assert.match(script, /LANG_SPANISHINTERNATIONAL/);
  assert.match(script, /install-language\.json/);
});
