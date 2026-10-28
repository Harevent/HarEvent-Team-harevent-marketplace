import {
  ArrowLeftRight,
  Compass,
  Layers3,
  MessageCircle,
  Star,
} from "lucide-react";

const benefits = [
  {
    title: "More Choices, One Platform",
    description: "Explore a wide range of event professionals and services across multiple categories.",
    icon: Layers3,
  },
  {
    title: "Convenient Discovery",
    description: "Find relevant vendors without having to search across multiple platforms.",
    icon: Compass,
  },
  {
    title: "Compare with Confidence",
    description: "Review available portfolios, services, pricing information, and genuine customer feedback.",
    icon: ArrowLeftRight,
  },
  {
    title: "Your Event, Your Preferences",
    description: "Discover professionals according to your occasion, location, style, and budget.",
    icon: Star,
  },
  {
    title: "Direct Vendor Connections",
    description: "Communicate with the professionals you choose to discuss your requirements.",
    icon: MessageCircle,
  },
];

function WhyChooseHarEvent() {
  return (
    <section className="w-full bg-[#FFF6F8] px-5 py-10 sm:px-8 sm:py-12 lg:px-8 lg:py-14">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-7">
          <p className="mb-1 flex items-center gap-2 !text-[10px] !font-bold uppercase !tracking-[1.2px] !text-[#D4145A]">
            <span className="h-[2px] w-6 bg-[#D4145A]" />
            Your Event, Your Way
          </p>
          <h2 className="!font-sans !text-[26px] !font-bold !leading-[1.2] !tracking-[-0.4px] !text-[#30232B] sm:!text-[30px]">
            Why Choose HarEvent?
          </h2>
          <p className="mt-1 !text-[13px] !leading-5 !text-[#8A7580]">
            Finding the right event professionals shouldn&apos;t be complicated. HarEvent brings event discovery and vendor connections together in one convenient place.
          </p>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-[0.72fr_1fr] lg:gap-7">
          <div className="relative min-h-[300px] overflow-hidden rounded-[16px] bg-[#5A3D38] sm:min-h-[330px]">
            <img
              src="/Opulent Indian Garden Wedding Mandap.png"
              alt="Garden wedding venue prepared for a celebration"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <h3 className="!font-sans !text-[19px] !font-semibold !leading-tight !text-white sm:!text-[21px]">
                More Choices, One Platform
              </h3>
              <p className="mt-1.5 max-w-[430px] !text-[12px] !leading-[1.5] !text-white/90">
                Explore a wide range of event professionals and services across multiple categories.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/60 bg-white/95 px-3 py-2.5 text-[#3A2931] shadow-sm sm:px-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-[#E60059]">
                  <Star size={17} fill="currentColor" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block !text-[11px] !font-semibold !leading-4">
                    Your vision matters.
                  </span>
                  <span className="block !text-[9px] !leading-3 !text-[#8A7580]">
                    We&apos;re here to help you find the right connections to bring it to life.
                  </span>
                </span>
                <Star
                  size={15}
                  className="ml-auto shrink-0 text-[#FF790D]"
                  fill="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2.5">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="flex min-h-[62px] items-center gap-3 rounded-[13px] border border-[#F1DDE5] bg-white px-3.5 py-2.5 sm:gap-4 sm:px-4"
              >
                <span className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border border-[#F5DCE6] bg-[#FFF4F7] text-[#E60059]">
                  <Icon
                    size={18}
                    strokeWidth={2}
                    fill={title === "Your Event, Your Preferences" ? "currentColor" : "none"}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block font-sans text-[13px] font-semibold leading-[1.25] text-[#382832] sm:text-[14px]">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-[1.35] text-[#8A7580] sm:text-[12px]">
                    {description}
                  </span>
                </span>
              </article>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

export default WhyChooseHarEvent;
