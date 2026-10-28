import {
  ArrowRight,
  Baby,
  CakeSlice,
  Heart,
  PartyPopper,
  Sparkles,
  UsersRound,
  Video,
  Utensils,
  Building2,
  BriefcaseBusiness,
  Flower2,
  Star,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import SectionImage from "./SectionImage";

const events = [
  {
    name: "Weddings",
    description: "Discover venues, decorators, photographers, caterers, and wedding specialists.",
    image: "/Golden Mandap Wedding Ceremony.png",
    icon: Heart,
    vendorCount: "4,200+ Vendors",
  },
  {
    name: "Birthdays",
    description: "Find creative decor, cakes, entertainment, and party services.",
    image: "/Joyful Birthday Cake Celebration.png",
    icon: CakeSlice,
    vendorCount: "1,850+ Vendors",
  },
  {
    name: "Engagements",
    description: "Make your special moment memorable with the right event professionals.",
    image: "/Rohan and Eisha’s Floral Engagement.png",
    icon: Sparkles,
    vendorCount: "1,400+ Vendors",
  },
  {
    name: "Corporate Events",
    description: "Explore venues and services for meetings, conferences, and corporate celebrations.",
    image: "/Corporate Summit Networking Reception.png",
    icon: BriefcaseBusiness,
    vendorCount: "950+ Vendors",
  },
  {
    name: "Baby Showers",
    description: "Discover beautiful decorations and services for welcoming a little one.",
    image: "/Elegant Pastel Baby Shower Celebration.png",
    icon: Baby,
    vendorCount: "680+ Vendors",
  },
  {
    name: "Anniversaries",
    description: "Celebrate your milestones with personalized event experiences.",
    image: "/Romantic Anniversary Cake Cutting Celebration.png",
    icon: PartyPopper,
    vendorCount: "850+ Vendors",
  },
  {
    name: "Receptions",
    description: "Find venues, decor, catering, and entertainment for your celebration.",
    image: "/Joyful Newlywed Entrance at Reception.png",
    icon: Utensils,
    vendorCount: "1,200+ Vendors",
  },
  {
    name: "Pre-Wedding Events",
    description: "Explore photography, makeup, styling, and celebration services.",
    image: "/Golden Hour Pre-Wedding Celebration.png",
    icon: Video,
    vendorCount: "1,100+ Vendors",
  },
  {
    name: "Naming Ceremonies",
    description: "Find professionals for your family's special occasion.",
    image: "/Elegant Indian Naming Ceremony Celebration.png",
    icon: Flower2,
    vendorCount: "500+ Vendors",
  },
  {
    name: "Family & Social Gatherings",
    description: "Bring people together with services tailored to your gathering.",
    image: "/Joyful Indian Family Celebration.png",
    icon: UsersRound,
    vendorCount: "750+ Vendors",
  },
  {
    name: "Farewell & Retirement",
    description: "Celebrate achievements and new beginnings with thoughtful event planning.",
    image: "/Farewell and Retirement Celebrations.png",
    icon: Building2,
    vendorCount: "400+ Vendors",
  },
];

function Events() {
  const carouselRef = useRef(null);
  const [activePage, setActivePage] = useState(0);

  const scrollToPage = (page) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    const pageCount = Math.max(
      1,
      Math.ceil(carousel.scrollWidth / carousel.clientWidth)
    );

    carousel.scrollTo({
      left: maxScroll * (page / Math.max(1, pageCount - 1)),
      behavior: "smooth",
    });

    setActivePage(page);
  };

  const updateActivePage = (carousel) => {
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    const pageCount = Math.max(
      1,
      Math.ceil(carousel.scrollWidth / carousel.clientWidth)
    );

    const progress =
      maxScroll > 0 ? carousel.scrollLeft / maxScroll : 0;

    setActivePage(
      Math.min(
        pageCount - 1,
        Math.round(progress * (pageCount - 1))
      )
    );
  };

  const pageCount = Math.max(1, Math.ceil(events.length / 4));

  return (
    <section className="overflow-hidden bg-white px-5 py-9 sm:px-8 lg:px-9 lg:py-10">
      <div className="mx-auto max-w-[1440px]">

        {/* Section Heading */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-[2px] w-6 shrink-0 bg-[#D4145A]" />
              <span className="text-[12px] font-bold uppercase tracking-[1.2px] text-[#D4145A]">
                Occasions &amp; Gatherings
              </span>
            </div>

            <h2 className="font-playfair text-[36px] font-bold leading-[1.2] tracking-tight text-[#30232B]">
              Explore Events
            </h2>

            <p className="mt-1 text-[16px] leading-6 text-[#8A7580]">
              Whatever the occasion, discover the right professionals and
              services to make it special.
            </p>
          </div>

          <Link
            to="/event-categories"
            className="inline-flex h-9 w-fit shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E60059] to-[#FF790D] px-4 text-[12px] font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
          >
            View All Events
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Scrollable Event Cards */}
        <div
          ref={carouselRef}
          onScroll={(e) => updateActivePage(e.currentTarget)}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#E9A0BA #FFF1F6",
          }}
        >
          {events.map(({ name, description, image, icon: Icon, vendorCount }) => (
            <Link
              key={name}
              to="/event-categories"
              className="group flex h-[340px] w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-[15px] border border-[#F1DDE5] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#E9A0BA] hover:shadow-[0_8px_20px_rgba(71,34,52,0.12)] sm:h-[355px] sm:w-[46%] md:w-[32%] lg:h-[370px] lg:w-[calc((100%-36px)/4)]"
            >
              {/* Card Image */}
              <div className="relative h-[210px] shrink-0 overflow-hidden sm:h-[220px] lg:h-[230px]">
                <SectionImage
                  src={image}
                  alt={`${name} celebration`}
                  icon={Icon}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />

                {name === "Weddings" && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#E60059] px-2.5 py-1 text-[10px] font-semibold leading-none text-white shadow-sm">
                    <Star size={10} fill="currentColor" strokeWidth={1.5} />
                    Popular
                  </span>
                )}
              </div>

              {/* Card Details */}
              <div className="flex min-h-0 flex-1 flex-col px-3 pb-2.5 pt-2.5 sm:px-3.5">
                <h3 className="mt-1 font-sans text-[16px] font-semibold leading-5 text-[#382832]">
                  {name}
                </h3>

                <p className="mt-1 line-clamp-2 text-[13px] leading-[1.4] text-[#8A7580]">
                  {description}
                </p>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#F2DDE5] pt-2">
                  <span
                    className={`inline-flex max-w-[calc(100%-32px)] items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${
                      ["Birthdays", "Corporate Events"].includes(name)
                        ? "bg-[#FFF3E9] text-[#F07814]"
                        : "bg-[#FFF1F6] text-[#D4145A]"
                    }`}
                  >
                    {vendorCount}
                  </span>

                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition duration-300 group-hover:scale-110 group-hover:shadow-md ${
                      ["Birthdays", "Corporate Events"].includes(name)
                        ? "bg-[#FF790D]"
                        : "bg-[#E60059]"
                    }`}
                  >
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Navigation Dots */}
        <div className="mt-3 flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }, (_, page) => (
            <button
              key={page}
              type="button"
              aria-label={`Show event page ${page + 1}`}
              aria-current={activePage === page ? "true" : undefined}
              onClick={() => scrollToPage(page)}
              className={`h-[7px] rounded-full transition-all duration-300 ${
                activePage === page
                  ? "w-5 bg-[#E60059]"
                  : "w-[7px] bg-[#F1D7E1] hover:bg-[#E9A0BA]"
              }`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}

export default Events