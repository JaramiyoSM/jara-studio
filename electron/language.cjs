function supportedLocale(value) {
  if (typeof value !== 'string') return null;
  const language = value.toLowerCase().split(/[-_]/)[0];
  return language === 'es' || language === 'en' ? language : null;
}

function preferredLocale(preferences, installation, system) {
  return (
    supportedLocale(preferences?.locale) ||
    supportedLocale(installation?.locale) ||
    supportedLocale(system) ||
    'en'
  );
}

module.exports = { supportedLocale, preferredLocale };
