
import { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
  Briefcase,
  Store,
  ChevronDown,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";

const serviceOptions = [
  "Photography & Videography",
  "Wedding & Event Decor",
  "Venues & Banquets",
  "Catering Services",
  "Makeup & Styling",
  "DJ & Entertainment",
  "Other",
];

function Signup({ vendorMode: initialVendorMode = false }) {
  const [vendorMode, setVendorMode] = useState(initialVendorMode);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serviceCategory, setServiceCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryError, setCategoryError] = useState(false);

  const fieldClass =
    "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-[#EED5DF] bg-[#FFFAFC] px-3 focus-within:border-2 focus-within:border-[#D4145A]";

  const inputClass =
    "w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-[#B3A3AA]";

  function switchMode() {
    setVendorMode((current) => !current);
    setCategoryOpen(false);
    setCategoryError(false);
    setSubmitted(false);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (vendorMode && !serviceCategory) {
      setCategoryError(true);
      setCategoryOpen(true);
      return;
    }

    setCategoryError(false);
    setSubmitted(true);
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#FFFAFC] p-4 font-poppins sm:p-6">
      <div className="flex w-full max-w-[900px] overflow-hidden rounded-[24px] bg-white shadow-[0_24px_60px_rgba(55,25,40,0.16)]">

        {/* Left Brand Panel */}
        <div
          className={`relative hidden overflow-hidden transition-colors duration-500 lg:block lg:w-[34%] ${
            vendorMode
              ? "bg-gradient-to-br from-[#A80F46] via-[#E60059] to-[#FF790D]"
              : "bg-gradient-to-br from-[#D4145A] via-[#E60059] to-[#FF790D]"
          }`}
        >
          <div className="absolute inset-0 bg-black/5" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-7 text-center text-white">
            <img
              src="/logoForm.jpeg"
              alt="HarEvent"
              className="mb-7 h-24 w-24 rounded-2xl bg-white/95 object-contain p-2 shadow-lg"
            />

            <h2 className="font-playfair text-3xl font-bold leading-tight">
              {vendorMode
                ? "Grow Your Event Business"
                : "Every Celebration Starts Here"}
            </h2>

            <p className="mt-4 max-w-[240px] text-sm leading-6 text-white/90">
              {vendorMode
                ? "Connect with customers and showcase your services with HarEvent."
                : "Discover trusted professionals and bring your special occasions to life."}
            </p>

            <div className="mt-8 h-1 w-16 rounded-full bg-white/80" />
          </div>

          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full border border-white/15" />
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full border border-white/15" />
        </div>

        {/* Right Form Panel */}
        <div className="flex w-full flex-col justify-center px-5 py-7 sm:px-9 lg:w-[66%] lg:px-10">
          <div className="mx-auto w-full max-w-[520px]">

            {/* Back and Logo */}
            <div className="relative mb-4 flex min-h-[64px] items-center justify-center">
              <Link
                to="/"
                className="absolute left-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 text-xs font-medium text-[#78646E] transition hover:text-[#D4145A]"
              >
                <ArrowLeft size={15} />
                Back
              </Link>

              <Link to="/" aria-label="HarEvent Home">
                <img
                  src="/logoForm.jpeg"
                  alt="HarEvent"
                  className="h-16 w-16 object-contain"
                />
              </Link>
            </div>

            {/* Heading and Mode Toggle */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-[#D4145A]">
                  {vendorMode ? "Vendor Portal" : "Customer Portal"}
                </p>

                <h1 className="mt-1 font-playfair text-xl font-bold tracking-tight text-[#30232B] sm:text-2xl">
                  {vendorMode ? "Join as a Vendor" : "Create an account"}
                </h1>
              </div>

              <button
                type="button"
                onClick={switchMode}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#F1DDE5] bg-[#FFF9FA] px-3 py-2 text-[10px] font-semibold text-[#D4145A] transition-colors hover:bg-[#FFF1F5] sm:text-[11px]"
              >
                {vendorMode ? <Store size={14} /> : <Briefcase size={14} />}
                {vendorMode ? "Switch to Customer" : "Switch to Vendor"}
              </button>
            </div>

            <p className="mb-4 text-xs leading-5 text-[#8A7580]">
              {vendorMode
                ? "Enter your business details to start receiving client leads."
                : "It only takes a moment to get started with your planning."}
            </p>

            {/* Signup Form */}
            <form
              onSubmit={handleSubmit}
              className="grid w-full grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2"
            >
              {/* Full Name */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#493640]">
                  Full Name
                </label>

                <div className={fieldClass}>
                  <UserRound size={15} className="shrink-0 text-[#D4145A]" />
                  <input
                    required
                    name="fullName"
                    autoComplete="name"
                    placeholder="e.g. Priya Sharma"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#493640]">
                  Email Address
                </label>

                <div className={fieldClass}>
                  <Mail size={15} className="shrink-0 text-[#D4145A]" />
                  <input
                    required
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#493640]">
                  Phone Number
                </label>

                <div className={fieldClass}>
                  <Phone size={15} className="shrink-0 text-[#D4145A]" />
                  <input
                    required
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#493640]">
                  Password
                </label>

                <div className={fieldClass}>
                  <LockKeyhole
                    size={15}
                    className="shrink-0 text-[#D4145A]"
                  />

                  <input
                    required
                    name="password"
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className={inputClass}
                  />

                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="shrink-0 text-[#8A7580] transition hover:text-[#D4145A]"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Vendor-only Fields */}
              {vendorMode && (
                <>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-[#493640]">
                      Business Name
                    </label>

                    <div className={fieldClass}>
                      <Store size={15} className="shrink-0 text-[#D4145A]" />
                      <input
                        required
                        name="businessName"
                        autoComplete="organization"
                        placeholder="Your business name"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Custom Service Dropdown */}
                  <div className="relative sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-[#493640]">
                      Service Category
                    </label>

                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={categoryOpen}
                      onClick={() => {
                        setCategoryOpen((open) => !open);
                        setCategoryError(false);
                      }}
                      className={`flex h-10 w-full items-center justify-between rounded-lg border-2 bg-[#FFFAFC] px-3 text-left text-xs outline-none transition ${
                        categoryError
                          ? "border-red-500"
                          : "border-[#D4145A] hover:bg-[#FFF1F5] focus:ring-2 focus:ring-[#D4145A]/20"
                      }`}
                    >
                      <span
                        className={
                          serviceCategory ? "text-[#493640]" : "text-[#8A7580]"
                        }
                      >
                        {serviceCategory || "Select category"}
                      </span>

                      <ChevronDown
                        size={16}
                        className={`text-[#D4145A] transition-transform ${
                          categoryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {categoryError && (
                      <p className="mt-1 text-[10px] text-red-600">
                        Please select a service category.
                      </p>
                    )}

                    {categoryOpen && (
                      <>
                        <button
                          type="button"
                          aria-label="Close service category menu"
                          className="fixed inset-0 z-20 cursor-default"
                          onClick={() => setCategoryOpen(false)}
                        />

                        <div
                          role="listbox"
                          aria-label="Service Category"
                          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[#F1DDE5] bg-white py-1 shadow-[0_12px_30px_rgba(55,25,40,0.18)]"
                        >
                          {serviceOptions.map((option) => {
                            const selected = serviceCategory === option;

                            return (
                              <button
                                key={option}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                  setServiceCategory(option);
                                  setCategoryOpen(false);
                                  setCategoryError(false);
                                }}
                                className={`flex min-h-9 w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                                  selected
                                    ? "bg-gradient-to-r from-[#D4145A] to-[#FF7628] font-semibold text-white"
                                    : "text-[#493640] hover:bg-gradient-to-r hover:from-[#D4145A] hover:to-[#FF7628] hover:text-white"
                                }`}
                              >
                                <span>{option}</span>
                                {selected && <Check size={14} />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <input
                      type="hidden"
                      name="serviceCategory"
                      value={serviceCategory}
                    />
                  </div>
                </>
              )}

              {/* Terms and Privacy */}
              <label className="flex cursor-pointer items-start gap-2 pt-1 text-[10px] leading-4 text-[#78646E] sm:col-span-2">
                <input
                  required
                  name="acceptTerms"
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#D4145A]"
                />

                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="underline">
                    Terms
                  </Link>{" "}
                  &amp;{" "}
                  <Link to="/privacy-policy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#D4145A] to-[#FF7628] text-xs font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg sm:col-span-2"
              >
                {vendorMode ? "Create Vendor Account" : "Create Account"}
              </button>

              {submitted && (
                <p
                  role="status"
                  className="rounded-lg bg-[#FFF0F5] px-3 py-2 text-center text-[11px] font-medium text-[#A80F46] sm:col-span-2"
                >
                  This is a UI preview. Account registration is not connected yet.
                </p>
              )}
            </form>

            {/* Sign In */}
            <p className="mt-4 text-center text-xs text-[#78646E]">
              Already have an account?{" "}
              <Link
                to={vendorMode ? "/?form=vendor" : "/?form=login"}
                className="font-semibold text-[#D4145A] hover:text-[#A80F46] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Signup;
