
import { BadgeCheck, MapPin } from "lucide-react";
import {
  FiFacebook,
  FiInstagram,
  FiLinkedin,
  FiYoutube,
} from "react-icons/fi";

function Footer() {
  const quickLinks = [
    ["Home", "/"],
    ["Event Planner", "/event-planners"],
    ["Event Category", "/event-categories"],
    ["Vendor Category", "/vendor-categories"],
    ["Blogs", "/blogs"],
  ];

  const companyLinks = [
    ["About HarEvent", "/about"],
    ["Contact Us", "/contact"],
    ["Privacy Policy", "/privacy-policy"],
    ["Terms & Conditions", "/terms"],
  ];

  const vendorLinks = [
    ["Join as Vendor", "/join-as-vendor"],
    ["Vendor Login", "/vendor-login"],
    ["Vendor Registration", "/join-as-vendor"],
    ["Partner Guidelines", "/partner-guidelines"],
  ];

  const socialLinks = [
    {
      name: "Instagram",
      icon: FiInstagram,
      url: "https://www.instagram.com/harevent_20/?hl=en",
    },
    {
      name: "YouTube",
      icon: FiYoutube,
      url: "https://www.youtube.com/",
    },
    {
      name: "LinkedIn",
      icon: FiLinkedin,
      url: "https://www.linkedin.com/in/harevent-company-20772a428/",
    },
    {
      name: "Facebook",
      icon: FiFacebook,
      url: "https://www.facebook.com/profile.php?id=61593053192328",
    },
  ];

  const linkClass =
    "inline-flex items-center font-poppins text-[15px] font-normal text-[#78646E] transition-colors duration-200 hover:text-[#D4145A]";

  return (
    <footer className="mt-1 w-full bg-white font-poppins">
      {/* Main Footer */}
      <div className="mx-auto w-full max-w-none px-5 pb-6 pt-6 sm:px-8 lg:px-[5.25%]">
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {/* Brand and Description */}
          <div className="max-w-[420px]">
            <a
              href="/"
              aria-label="HarEvent Home"
              className="mb-3 inline-flex items-center"
            >
              <img
                src="/logo.png"
                alt="HarEvent"
                className="h-[110px] w-[110px] object-contain"
              />
            </a>

            <h3 className="mb-1 font-playfair text-[22px] !font-bold leading-snug text-[#32252D]">
              One Platform. Every Event. Every Vendor.
            </h3>

            <p className="!text-[15px] font-normal leading-[1.7] text-[#78646E]">
              HarEvent helps customers discover event professionals
              and services for weddings, celebrations, corporate
              functions, and special occasions.
            </p>

            {/* Social Icons */}
            <div className="mt-4 flex w-full items-center gap-3">
              {socialLinks.map(({ name, icon: Icon, url }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  title={name}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E60059] p-0 text-white transition-colors duration-200 hover:bg-[#C90D50]"
                >
                  <Icon
                    size={19}
                    strokeWidth={2.5}
                    className="shrink-0"
                  />
                </a>
              ))}
            </div>

            {/* Trust Badges */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF2E9] px-2.5 py-1 font-poppins !text-[12px] font-medium uppercase tracking-wide text-[#E76A25]">
                <BadgeCheck size={12} />
                100% Verified
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FCE8F0] px-2.5 py-1 font-poppins !text-[12px] font-medium uppercase tracking-wide text-[#D4145A]">
                <MapPin size={12} />
                Pan India
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="xl:pt-[70px]">
            <h3 className="mb-4 font-playfair text-[22px] font-semibold text-[#32252D]">
              Quick Links
            </h3>

            <ul className="space-y-2.5">
              {quickLinks.map(([name, to]) => (
                <li key={name}>
                  <a href={to} className={linkClass}>
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="xl:pt-[70px]">
            <h3 className="mb-4 font-playfair text-[22px] font-semibold text-[#32252D]">
              Company
            </h3>

            <ul className="space-y-2.5">
              {companyLinks.map(([name, to]) => (
                <li key={name}>
                  <a href={to} className={linkClass}>
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* For Vendors */}
          <div className="xl:pt-[70px]">
            <h3 className="mb-4 font-playfair text-[22px] font-semibold text-[#32252D]">
              For Vendors
            </h3>

            <ul className="space-y-2.5">
              {vendorLinks.map(([name, to]) => (
                <li key={name}>
                  <a href={to} className={linkClass}>
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Full-Width Bottom Copyright Strip */}
      <div className="w-full bg-[#FFF2F4] px-4 py-4 text-center">
        <p className="font-poppins !text-[13px] font-normal leading-5 text-[#8A7580]">
          © 2026 HarEvent India Private Limited. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
