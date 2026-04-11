import { useLanguage } from "@/i18n/LanguageContext";

const LanguageToggle = () => {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex rounded-full bg-primary-foreground/20 overflow-hidden text-xs font-extrabold">
      <button
        onClick={() => setLocale("es")}
        className={`px-2.5 py-1 transition-all ${
          locale === "es"
            ? "bg-primary-foreground text-foreground"
            : "text-primary-foreground hover:bg-primary-foreground/10"
        }`}
      >
        🇪🇸 ES
      </button>
      <button
        onClick={() => setLocale("qu")}
        className={`px-2.5 py-1 transition-all ${
          locale === "qu"
            ? "bg-primary-foreground text-foreground"
            : "text-primary-foreground hover:bg-primary-foreground/10"
        }`}
      >
        🇵🇪 QU
      </button>
    </div>
  );
};

export default LanguageToggle;
