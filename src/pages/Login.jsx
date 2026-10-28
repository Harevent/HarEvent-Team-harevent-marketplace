import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link } from "react-router-dom";

function Login({ initialMode = "customer" }) {
  const mode = initialMode;
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFFAFC] px-4 py-4 sm:px-6 sm:py-6">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-[#78646E] hover:text-[#D4145A]">
          <ArrowLeft size={16} /> Back to HarEvent
        </Link>

        <section className="rounded-2xl border border-[#F1DDE5] bg-white p-5 shadow-[0_12px_32px_rgba(89,32,55,0.08)] sm:p-6">
            <div className="mb-4">
              <Link to="/" className="inline-flex rounded-lg bg-white">
                <img src="/logo.png" alt="HarEvent" className="h-8 w-auto object-contain" />
              </Link>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-[#D4145A]">Your HarEvent account</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#30232B]">
              {mode === "vendor" ? "Login as Vendor" : "Welcome back"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#8A7580]">
              {mode === "vendor"
                ? "Manage your listings, leads, and customer bookings."
                : "Enter your details to sign in to your account."}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <label className="block text-[11px] font-semibold text-[#493640]">
                {mode === "vendor" ? "Email / Phone Number" : "Email address"}
                <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-lg border border-[#EED5DF] bg-[#FFFAFC] px-3 focus-within:border-[#D4145A]">
                  <Mail size={15} className="shrink-0 text-[#D4145A]" />
                  <input
                    required
                    type={mode === "vendor" ? "text" : "email"}
                    autoComplete={mode === "vendor" ? "username" : "email"}
                    placeholder={mode === "vendor" ? "Enter mobile or email" : "you@example.com"}
                    className="min-w-0 flex-1 bg-transparent text-xs font-normal text-[#382832] outline-none placeholder:text-[#B3A3AA]"
                  />
                </span>
              </label>

              <label className="block text-[11px] font-semibold text-[#493640]">
                Password
                <span className="mt-1.5 flex h-10 items-center gap-2.5 rounded-lg border border-[#EED5DF] bg-[#FFFAFC] px-3 focus-within:border-[#D4145A]">
                  <LockKeyhole size={15} className="shrink-0 text-[#D4145A]" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="min-w-0 flex-1 bg-transparent text-xs font-normal text-[#382832] outline-none placeholder:text-[#B3A3AA]"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="shrink-0 text-[#8A7580] hover:text-[#D4145A]"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              <div className="flex items-center justify-between gap-3 text-[11px]">
                <label className="flex items-center gap-2 text-[#78646E]">
                  <input type="checkbox" className="accent-[#D4145A]" />
                  Remember me
                </label>
                <button type="button" className="font-semibold text-[#D4145A] hover:text-[#A80F46]">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#D4145A] to-[#FF7628] text-xs font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Sign In
              </button>
              {submitted && (
                <p role="status" className="rounded-xl bg-[#FFF0F5] px-4 py-3 text-xs leading-5 text-[#A80F46]">
                  This is a UI preview. Sign-in is not connected yet.
                </p>
              )}
            </form>

            <p className="mt-5 text-center text-xs text-[#78646E]">
              Don&apos;t have an account?{" "}
              <Link
                to={mode === "vendor" ? "/join-as-vendor" : "/signup"}
                className="font-semibold text-[#D4145A] hover:text-[#A80F46]"
              >
                {mode === "vendor" ? "Register Now" : "Create account"}
              </Link>
            </p>
        </section>
      </div>
    </main>
  );
}

export default Login;
