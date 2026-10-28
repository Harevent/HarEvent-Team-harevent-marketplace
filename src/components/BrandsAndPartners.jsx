
import { useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Building2,
  Cake,
  Camera,
  Heart,
  ShieldCheck,
  Star,
  Utensils,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

// Custom lotus icon for Royal Florist
function LotusIcon({ size = 35 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18 31C12.3 25.5 11.5 17.5 18 6C24.5 17.5 23.7 25.5 18 31Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 31C9.5 31 4 25 4 17C11 17.5 15.5 22 18 31Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 31C26.5 31 32 25 32 17C25 17.5 20.5 22 18 31Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const highlights = [
  {
    title: "Verified Vendors",
    detail: "Only trusted &\nauthentic providers",
    icon: ShieldCheck,
  },
  {
    title: "Quality\nAssured",
    detail: "Top-rated pros\nacross India",
    icon: Star,
  },
  {
    title: "15,000+\nPartners",
    detail: "Across Tier-1 &\nTier-2 cities",
    icon: UsersRound,
  },
];

const categories = [
  {
    name: "Royal Florist",
    category: "Flower Decor",
    icon: LotusIcon,
    color: "pink",
  },
  {
    name: "Lumiere Studios",
    category: "Photography",
    icon: Camera,
    color: "orange",
  },
  {
    name: "Food Atelier",
    category: "Catering",
    icon: Utensils,
    color: "pink",
  },
  {
    name: "After Weddings",
    category: "Wedding Planning",
    icon: Heart,
    color: "pink",
    popular: true,
  },
  {
    name: "Vibe Events",
    category: "DJ & Entertainment",
    icon: AudioLines,
    color: "orange",
  },
  {
    name: "Grand Stays",
    category: "Venues",
    icon: Building2,
    color: "pink",
  },
  {
    name: "Sweet Delights",
    category: "Cake & Desserts",
    icon: Cake,
    color: "orange",
  },
  {
    name: "Grand Stays",
    category: "Venues",
    icon: Building2,
    color: "pink",
  },
  {
    name: "Sweet Delights",
    category: "Cake & Desserts",
    icon: Cake,
    color: "orange",
  },
];

function BrandsAndPartners() {
  const [isPaused, setIsPaused] = useState(false);

  const renderPartnerCard = (
    { name, category, icon: Icon, color, popular },
    index,
    duplicate = false
  ) => (
    <Link
      key={`${name}-${category}-${index}-${duplicate ? "duplicate" : "original"}`}
      to="/vendor-categories"
      tabIndex={duplicate ? -1 : undefined}
      aria-hidden={duplicate ? "true" : undefined}
      onPointerDown={() => setIsPaused(true)}
      onPointerUp={() => setIsPaused(false)}
      onPointerCancel={() => setIsPaused(false)}
      onPointerLeave={() => setIsPaused(false)}
      className={`partner-card group relative flex h-[190px] w-[175px] shrink-0 flex-col items-center rounded-[16px] border-2 px-2 pt-8 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:border-[#E9A0BB] hover:shadow-[0_10px_24px_rgba(71,34,52,0.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4145A] focus-visible:ring-offset-2 sm:w-[170px] ${
        popular
          ? "border-[#F3A0BD] bg-gradient-to-b from-[#FFF9FB] to-[#FFF5F8] shadow-[0_2px_5px_rgba(212,20,90,0.10)]"
          : "border-[#F2D7E1] bg-white shadow-[0_1px_2px_rgba(70,25,45,0.04)]"
      }`}
    >
      {/* Popular Badge */}
      {popular && (
        <span className="absolute -top-[9px] right-2 flex h-5 items-center gap-1 rounded-full bg-[#E60059] px-2.5 font-poppins text-[11px] font-semibold text-white">
          <Star size={11} fill="currentColor" />
          Popular
        </span>
      )}

      {/* Icon */}
      <span
        className={`mb-3 flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] text-white transition-transform duration-300 group-hover:scale-110 ${
          color === "pink" ? "bg-[#E60059]" : "bg-[#FF790D]"
        }`}
      >
        {name === "Royal Florist" ? (
          <LotusIcon size={35} />
        ) : name === "After Weddings" ? (
          <Heart size={31} strokeWidth={1.3} />
        ) : (
          <Icon size={31} strokeWidth={2.3} />
        )}
      </span>

      {/* Partner Name */}
      <span className="max-w-full text-center font-poppins text-[13px] font-bold leading-[1.3] text-[#382A32] transition-colors duration-300 group-hover:text-[#D4145A]">
        {name}
      </span>

      {/* Category */}
      <span
        className={`mt-2.5 flex h-6 max-w-full items-center justify-center whitespace-nowrap rounded-full px-5 font-poppins text-[10px] font-semibold leading-none ${
          popular
            ? "bg-[#F9C9DB] text-[#D4145A]"
            : color === "pink"
              ? "bg-[#FFF0F5] text-[#E60059]"
              : "bg-[#FFF3E8] text-[#F07816]"
        }`}
      >
        {category}
      </span>
    </Link>
  );

  return (
    <section className="w-full overflow-hidden bg-white px-5 pb-8 pt-8 sm:px-8 lg:px-[4.55%] lg:pb-10">
      <div className="mx-auto max-w-[1440px]">
        {/* Heading and Statistics */}
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1.05fr_1.55fr] lg:gap-7">
          {/* Left Content */}
          <div className="min-w-0">
            <p className="mb-[10px] flex items-center gap-[9px] font-poppins text-[13px] font-bold uppercase tracking-[1.25px] text-[#E60059]">
              <span className="h-[2px] w-[30px] bg-[#E60059]" />
              Network Excellence
            </p>

            <h2 className="font-playfair text-[30px] font-bold leading-[1.2] tracking-tight text-[#292327] sm:text-[36px]">
              Trusted Brands &{" "}
              <span className="font-playfair font-bold text-[#D4145A]">
                Partners
              </span>
            </h2>

            <p className="mt-3 max-w-[530px] font-poppins text-[16px] leading-[1.6] text-[#8D7A85]">
              Work with certified event service providers who bring quality,
              reliability and creativity to your special moments.
            </p>
          </div>

          {/* Right Content */}
          <div className="flex min-w-0 flex-col items-end gap-3 lg:flex-row lg:items-end">
            {/* Trust Statistics Panel */}
            <ul className="grid min-h-[87px] w-full min-w-0 flex-1 grid-cols-3 items-center rounded-[16px] border border-[#F5D7E1] bg-[#FFFAFC] px-2 py-3">
              {highlights.map(({ title, detail, icon: Icon }, index) => (
                <li
                  key={title}
                  className={`flex min-h-[58px] min-w-0 items-center gap-2 px-2 ${
                    index > 0 ? "border-l border-[#F0DDE5]" : ""
                  }`}
                >
                  <span className="flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full border border-[#F7D5E1] bg-white text-[#E60059] shadow-sm">
                    <Icon
                      size={17}
                      strokeWidth={2}
                      fill={index === 1 ? "currentColor" : "none"}
                    />
                  </span>

                  <span className="min-w-0">
                    <span className="block whitespace-pre-line font-poppins text-[12px] font-bold leading-[1.2] text-[#30272C]">
                      {title}
                    </span>

                    <span className="mt-1 block whitespace-pre-line font-poppins text-[10px] leading-[1.3] text-[#95838C] sm:text-[11px]">
                      {detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {/* View All Partners */}
            <Link
              to="/vendor-categories"
              className="inline-flex h-[35px] shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E60059] to-[#FF790D] px-[18px] font-poppins text-[12px] font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              View all partners
              <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* Infinite Auto-Scrolling Carousel */}
        <div
          className={`partners-carousel mt-9 ${isPaused ? "is-paused" : ""}`}
          aria-label="Browse trusted brands and partners"
          onPointerUp={() => setIsPaused(false)}
          onPointerCancel={() => setIsPaused(false)}
          onPointerLeave={() => setIsPaused(false)}
        >
          <div className="partners-track">
            {/* Original Cards */}
            <div className="partners-group">
              {categories.map((item, index) =>
                renderPartnerCard(item, index)
              )}
            </div>

            {/* Duplicate Cards for Seamless Loop */}
            <div className="partners-group" aria-hidden="true">
              {categories.map((item, index) =>
                renderPartnerCard(item, index, true)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Carousel and Hover Animations */}
      <style>{`
        .partners-carousel {
          width: 100%;
          overflow: hidden;
          padding-top: 12px;
          padding-bottom: 12px;
          touch-action: pan-y;
        }

        .partners-track {
          display: flex;
          width: max-content;
          animation: partnersMarquee 38s linear infinite;
          will-change: transform;
        }

        .partners-group {
          display: flex;
          flex: 0 0 auto;
          align-items: stretch;
          gap: 12px;
          padding-right: 12px;
        }

        .partners-carousel:hover .partners-track,
        .partners-carousel.is-paused .partners-track,
        .partners-carousel:focus-within .partners-track {
          animation-play-state: paused;
        }

        .partner-card {
          animation: partnerCardEnter 550ms ease-out both;
          -webkit-tap-highlight-color: transparent;
        }

        .partner-card:active {
          transform: scale(0.98);
        }

        @keyframes partnersMarquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes partnerCardEnter {
          from {
            opacity: 0;
            translate: 0 10px;
          }
          to {
            opacity: 1;
            translate: 0 0;
          }
        }

        @media (max-width: 640px) {
          .partners-track {
            animation-duration: 32s;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .partners-track {
            animation: none;
          }

          .partner-card {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}

export default BrandsAndPartners;
