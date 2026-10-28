import { ArrowRight, MessageCircleHeart } from "lucide-react";
import { Link } from "react-router-dom";

function CustomerAssistance() {
  return (
    <section className="bg-white px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 rounded-3xl border border-[#F1DDE5] bg-[#FFFAFC] p-6 sm:p-8 md:flex-row md:items-center md:justify-between lg:p-10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F5] text-[#D4145A]">
            <MessageCircleHeart size={23} />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#30232B] sm:text-3xl">
              Need Help Finding the Right Vendor?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8A7580]">
              Tell us about your upcoming event, and let us help you discover services that match your requirements.
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[#8A7580]">
              Whether you&apos;re planning a wedding, birthday, corporate function, or another special occasion, we&apos;re here to help you take the next step.
            </p>
          </div>
        </div>
        <Link
          to="/contact"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[#D4145A] to-[#FF7628] px-5 py-3 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          Send an Inquiry <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

export default CustomerAssistance;
