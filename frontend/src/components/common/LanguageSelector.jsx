const LANGUAGES = [
  { code: 'auto', label: 'Auto', icon: '🌐' },
  { code: 'en', label: 'English', icon: '🇺🇸' },
  { code: 'hi', label: 'हिन्दी', icon: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', icon: '🇮🇳' },
];

export default function LanguageSelector({ language, onSelectLanguage }) {
  return (
    <div className="language-selector-wrapper">
      <svg
        className="lang-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <select
        id="language-select"
        className="language-select"
        value={language}
        onChange={(e) => onSelectLanguage(e.target.value)}
        aria-label="Select language"
        title="Select language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.icon} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
