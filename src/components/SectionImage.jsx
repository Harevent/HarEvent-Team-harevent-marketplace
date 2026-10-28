import { useState } from "react";

function SectionImage({ src, alt, icon: Icon, className = "" }) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(src));

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-[#FFF0F5] via-[#FFF8F2] to-[#FCE4EC] ${className}`}>
      {imageAvailable ? (
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageAvailable(false)}
        />
      ) : (
        <div
          aria-label={alt}
          className="absolute inset-0 flex items-center justify-center text-[#D4145A]/55"
          role="img"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/70 shadow-sm">
            <Icon size={27} strokeWidth={1.6} />
          </div>
        </div>
      )}
    </div>
  );
}

export default SectionImage;
