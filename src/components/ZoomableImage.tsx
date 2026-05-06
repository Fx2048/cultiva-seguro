import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
};

const ZoomableImage = ({ src, alt = "", className = "", onError }: Props) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="relative group inline-block w-full">
        <img src={src} alt={alt} className={className} onError={onError} loading="lazy" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-background/90 border border-border text-xs font-bold shadow-md opacity-90 hover:opacity-100 hover:bg-background"
          aria-label="Ver imagen completa"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Ver completa
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Cerrar"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="max-w-[95vw] max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className="max-w-none w-auto h-auto rounded-lg shadow-2xl"
              style={{ maxHeight: "none" }}
            />
          </div>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs">
            Click fuera o ESC para cerrar · scroll para explorar
          </p>
        </div>
      )}
    </>
  );
};

export default ZoomableImage;