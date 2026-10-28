import { ArrowRight, Store } from "lucide-react";
import { Link } from "react-router-dom";

function VendorRegistrationBanner({ onVendorLoginClick, onVendorRegisterClick }) {
  return (
    <section className="px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-3xl bg-gradient-to-r from-[#8E1748] via-[#D4145A] to-[#F36B32] px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14 lg:py-12">
        <div className="relative max-w-2xl">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-white/80">
            Grow Your Event Business
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Are You an Event Professional?
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/90">
            Showcase your services, connect with potential customers, and grow your business with HarEvent.
          </p>
          <p className="mt-2 text-xs leading-5 text-white/80">
            Make your work discoverable to people looking for event professionals and services.
          </p>
        </div>

        <div className="relative mt-7 flex shrink-0 flex-col items-start gap-4 lg:mt-0 lg:items-end">
          {onVendorRegisterClick ? (
            <button
              type="button"
              onClick={onVendorRegisterClick}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-[#B20F4B] shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Store size={16} /> Join as a Vendor <ArrowRight size={15} />
            </button>
          ) : (
            <Link
              to="/join-as-vendor"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-[#B20F4B] shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Store size={16} /> Join as a Vendor <ArrowRight size={15} />
            </Link>
          )}
          {onVendorLoginClick ? (
            <button
              type="button"
              onClick={onVendorLoginClick}
              className="text-xs font-medium text-white/90 underline decoration-white/50 underline-offset-4 hover:text-white"
            >
              Already a vendor? Log in
            </button>
          ) : (
            <Link
              to="/vendor-login"
              className="text-xs font-medium text-white/90 underline decoration-white/50 underline-offset-4 hover:text-white"
            >
              Already a vendor? Log in
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default VendorRegistrationBanner;
