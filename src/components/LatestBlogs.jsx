import { ArrowRight, Camera, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import SectionImage from "./SectionImage";

const articles = [
  {
    title: "How to Choose the Right Wedding Photographer",
    description: "Learn how to evaluate photography styles, portfolios, experience, and packages before making your decision.",
    image: "/Golden Meadow Wedding Photoshoot.png",
    icon: Camera,
  },
  {
    title: "10 Things to Check Before Booking an Event Venue",
    description: "Discover the essential details to consider when choosing the perfect venue for your event.",
    image: "/Lavish Red and Gold Wedding Stage.png",
    icon: MapPin,
  },
  {
    title: "How to Plan a Beautiful Event on a Budget",
    description: "Explore practical ways to prioritize your requirements, compare vendors, and plan your event thoughtfully.",
    image: "/Joyful Indian Wedding Procession.png",
    icon: Wallet,
  },
];

function LatestBlogs() {
  return (
    <section className="bg-[#FFF3F5] px-5 py-8 sm:px-8 lg:px-[30px] lg:py-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.5px] text-[#D4145A]">
              Guides & Inspiration
            </p>
            <h2 className="!font-playfair !text-[36px] !font-bold !leading-[1.2] !tracking-[-0.5px] !text-[#292329]">
              Latest From HarEvent
            </h2>
            <p className="mt-1 !text-[16px] !leading-6 !text-[#75656C] xl:whitespace-nowrap">
              Get inspired with practical planning tips, creative ideas, and helpful insights for your next celebration.
            </p>
          </div>
          <Link
            to="/blogs"
            className="inline-flex h-9 w-fit shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E60059] to-[#FF790D] px-4 !text-[12px] !font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Explore All Articles <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3 md:gap-6 lg:gap-[7.2%]">
          {articles.map(({ title, description, image, icon: Icon }) => (
            <article
              key={title}
              className="min-h-[430px] overflow-hidden rounded-[15px] bg-white shadow-[0_2px_8px_rgba(71,34,52,0.04)]"
            >
              <SectionImage
                src={image}
                alt={title}
                icon={Icon}
                className="h-[210px]"
              />
              <div className="min-h-[220px] p-5">
                <div role="heading" aria-level="3" className="font-sans text-[16px] font-semibold leading-[1.35] text-[#30272D]">
                  {title}
                </div>
                <p className="mt-2 line-clamp-2 !text-[13px] !leading-[1.35] !text-[#897A81]">
                  {description}
                </p>
                <Link
                  to="/blogs"
                  className="mx-auto my-8 flex w-fit items-center gap-1 !text-[16px] !font-bold !text-[#E60059] transition hover:text-[#A80F46]"
                >
                  Read More <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LatestBlogs;
