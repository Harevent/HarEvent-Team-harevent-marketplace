import { useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, MessageCircle, Send, ShieldCheck, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

function Enquiry() {
  const [searchParams] = useSearchParams();
  const vendor = searchParams.get("vendor") || "Event Professional";
  const category = searchParams.get("category") || "Vendor";
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF8FA] px-4 py-4 sm:px-6 sm:py-6">
      <div className="w-full max-w-lg">
        <Link to="/" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-[#78646E] hover:text-[#D4145A]">
          <ArrowLeft size={16} /> Back to HarEvent
        </Link>

        <div className="overflow-hidden rounded-2xl border border-[#F1DDE5] bg-white shadow-[0_12px_32px_rgba(89,32,55,0.08)]">
          <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#D4145A]">Direct Inquiry · {category}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#30232B] sm:text-2xl">
                {vendor}
              </h1>
              <p className="mt-1 text-xs leading-5 text-[#8A7580]">Share a few details so the professional can understand your event.</p>
            </div>
            <Link to="/" aria-label="Close inquiry" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F1F4] text-[#8A7580] transition hover:bg-[#FCE8F0] hover:text-[#D4145A]">
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </Link>
          </header>

          <form onSubmit={handleSubmit} className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
            <label className="block text-[11px] font-semibold text-[#493640]">
              Your Full Name
              <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-lg border border-[#EED5DF] bg-[#FFFAFC] px-3 focus-within:border-[#D4145A]">
                <UserRound size={15} className="shrink-0 text-[#D4145A]" />
                <input required autoComplete="name" placeholder="e.g. Priya Sharma" className="min-w-0 flex-1 bg-transparent text-xs font-normal outline-none placeholder:text-[#B3A3AA]" />
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-semibold text-[#493640]">
                Phone (WhatsApp)
                <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-lg border border-[#EED5DF] bg-[#FFFAFC] px-3 focus-within:border-[#D4145A]">
                  <MessageCircle size={15} className="shrink-0 text-[#D4145A]" />
                  <input required type="tel" autoComplete="tel" placeholder="+91 98765 43210" className="min-w-0 flex-1 bg-transparent text-xs font-normal outline-none placeholder:text-[#B3A3AA]" />
                </span>
              </label>
              <label className="block text-[11px] font-semibold text-[#493640]">
                Event Date
                <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-lg border border-[#EED5DF] bg-[#FFFAFC] px-3 focus-within:border-[#D4145A]">
                  <CalendarDays size={15} className="shrink-0 text-[#D4145A]" />
                  <input type="date" className="min-w-0 flex-1 bg-transparent text-xs font-normal text-[#493640] outline-none" />
                </span>
              </label>
            </div>

            <label className="block text-[11px] font-semibold text-[#493640]">
              Approx. Guest Count & Requirements
              <textarea required rows={3} placeholder="Tell the vendor about your event, guest size, and specific wishes..." className="mt-1.5 w-full resize-y rounded-lg border border-[#EED5DF] bg-[#FFFAFC] px-3 py-2.5 text-xs font-normal leading-5 outline-none placeholder:text-[#B3A3AA] focus:border-[#D4145A]" />
            </label>

            <div className="flex items-start gap-2.5 rounded-lg border border-[#F8D7E2] bg-[#FFF0F5] px-3 py-2.5 text-[11px] leading-4 text-[#765865]">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#D4145A]" />
              <p>Your inquiry details will be ready to share with the selected event professional.</p>
            </div>

            <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#D4145A] px-5 py-3 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(212,20,90,0.25)] transition hover:-translate-y-0.5 hover:bg-[#A80F46] hover:shadow-lg">
              <Send size={15} /> Submit Inquiry
            </button>
            {submitted && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-[#F0FAF3] px-4 py-3 text-xs leading-5 text-[#247A45]">
                <CheckCircle2 size={16} className="shrink-0" />
                This is a UI preview. Inquiry submission is not connected yet.
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

export default Enquiry;
