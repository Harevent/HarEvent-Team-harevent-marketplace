import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  Store,
  UserRound,
  X,
} from "lucide-react";

function LoginModal({ onClose, onRegister, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode.startsWith("vendor") ? "vendor" : "customer");
  const view = initialMode.includes("signup") ? "signup" : "login";
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-5 backdrop-blur-sm"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="relative bg-gradient-to-r from-[#D4145A] to-[#FF7628] px-6 pb-6 pt-7 text-center text-white sm:px-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
          >
            <X size={19} />
          </button>
          <img
            src="/logoForm.jpeg"
            alt="HarEvent"
            className="mx-auto h-12 w-12 rounded-full bg-white object-contain"
          />
          <h2 id="login-modal-title" className="mt-3 text-2xl font-bold">
            {view === "signup"
              ? mode === "vendor" ? "Register as Vendor" : "Create Account"
              : `Login as ${mode === "vendor" ? "Vendor" : "Customer"}`}
          </h2>
          <p className="mt-1 text-xs text-white/90">
            {view === "signup"
              ? mode === "vendor"
                ? "Create your vendor account to get started"
                : "Join HarEvent and plan your celebration"
              : mode === "vendor"
              ? "Manage listings, leads, and customer bookings"
              : "Discover event professionals and manage your plans"}
          </p>
        </header>

        <div className="p-5 sm:p-7">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#F3F5F9] p-1">
            {[
              { value: "customer", label: "Customer", icon: UserRound },
              { value: "vendor", label: "Vendor", icon: Store },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setSubmitted(false);
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                  mode === value
                    ? "bg-white text-[#D4145A] shadow-sm"
                    : "text-[#718096] hover:text-[#493640]"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === "signup" && (
              <label className="block text-xs font-semibold text-[#493640]">
                {mode === "vendor" ? "Full Name" : "Your Full Name"}
                <span className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border border-[#E5E9EF] px-3.5 focus-within:border-[#D4145A]">
                  <UserRound size={16} className="shrink-0 text-[#91A0B3]" />
                  <input
                    required
                    autoComplete="name"
                    placeholder="e.g. Priya Sharma"
                    className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-[#A0AAB7]"
                  />
                </span>
              </label>
            )}
            {view === "signup" && mode === "vendor" && (
              <label className="block text-xs font-semibold text-[#493640]">
                Business Name
                <input
                  required
                  placeholder="Enter your business name"
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E9EF] px-3.5 text-sm font-normal outline-none placeholder:text-[#A0AAB7] focus:border-[#D4145A]"
                />
              </label>
            )}
            <label className="block text-xs font-semibold text-[#493640]">
              {view === "signup" ? "Email Address" : "Email / Phone Number"}
              <span className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border border-[#E5E9EF] px-3.5 focus-within:border-[#D4145A]">
                <Mail size={16} className="shrink-0 text-[#91A0B3]" />
                <input
                  required
                  type={view === "signup" ? "email" : "text"}
                  autoComplete={view === "signup" ? "email" : "username"}
                  placeholder={view === "signup" ? "you@example.com" : "Enter mobile or email"}
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-[#A0AAB7]"
                />
              </span>
            </label>

            {view === "signup" && (
              <label className="block text-xs font-semibold text-[#493640]">
                Phone Number
                <span className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border border-[#E5E9EF] px-3.5 focus-within:border-[#D4145A]">
                  <Phone size={16} className="shrink-0 text-[#91A0B3]" />
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-[#A0AAB7]"
                  />
                </span>
              </label>
            )}
            {view === "signup" && mode === "vendor" && (
              <label className="block text-xs font-semibold text-[#493640]">
                Service Category
                <select
                  required
                  defaultValue=""
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#E5E9EF] bg-white px-3.5 text-sm font-normal text-[#667085] outline-none focus:border-[#D4145A]"
                >
                  <option value="" disabled>Select a category</option>
                  <option>Photography</option>
                  <option>Decor</option>
                  <option>Venue</option>
                  <option>Catering</option>
                  <option>Entertainment</option>
                  <option>Other</option>
                </select>
              </label>
            )}
            <label className="block text-xs font-semibold text-[#493640]">
              Password
              <span className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border border-[#E5E9EF] px-3.5 focus-within:border-[#D4145A]">
                <LockKeyhole size={16} className="shrink-0 text-[#91A0B3]" />
                <input
                  required
                  minLength={view === "signup" ? 8 : undefined}
                  type={showPassword ? "text" : "password"}
                  autoComplete={view === "signup" ? "new-password" : "current-password"}
                  placeholder={view === "signup" ? "At least 8 characters" : "Enter your password"}
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-[#A0AAB7]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="text-[#8995A5] hover:text-[#D4145A]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {view === "signup" && (
              <label className="flex items-start gap-2 text-xs font-normal leading-5 text-[#667085]">
                <input required type="checkbox" className="mt-1 accent-[#D4145A]" />
                <span>I agree to the terms and privacy policy.</span>
              </label>
            )}

            {view === "login" && (
            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 font-normal text-[#667085]">
                <input type="checkbox" className="accent-[#D4145A]" />
                Remember me
              </label>
              <button type="button" className="font-semibold text-[#D4145A] hover:text-[#A80F46]">
                Forgot Password?
              </button>
            </div>
            )}

            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#D4145A] to-[#FF7628] text-sm font-semibold text-white shadow-md transition hover:brightness-105"
            >
              {view === "signup" ? "Create Account" : "Sign In & Continue"}
            </button>
            {submitted && (
              <p role="status" className="rounded-lg bg-[#FFF0F5] px-3 py-2 text-xs text-[#A80F46]">
                This is a UI preview. {view === "signup" ? "Registration" : "Login"} is not connected yet.
              </p>
            )}
          </form>

          <p className="mt-5 border-t border-[#F1F1F1] pt-4 text-center text-xs text-[#7B8794]">
            {view === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                onRegister(
                  view === "signup"
                    ? mode === "vendor" ? "vendor" : "login"
                    : mode === "vendor" ? "vendor-signup" : "signup",
                );
              }}
              className="font-semibold text-[#D4145A] hover:text-[#A80F46]"
            >
              {view === "signup" ? "Sign In" : "Register Now"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}

export default LoginModal;
