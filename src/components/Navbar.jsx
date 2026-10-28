
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Search, UserRound, X } from "lucide-react";

function Navbar({ onLoginClick }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const links = [
    { name: "Home", to: "/" },
    { name: "Event Planner", to: "/event-planners" },
    { name: "Event Category", to: "/event-categories" },
    { name: "Vendor Category", to: "/vendor-categories" },
    { name: "Blogs", to: "/blogs" },
    { name: "About Us", to: "/about" },
    { name: "Contact Us", to: "/contact" },
  ];

  const linkClass = ({ isActive }) =>
    `whitespace-nowrap rounded-md px-2.5 py-2 !text-[14px] !font-semibold font-poppins transition-colors ${
      isActive
        ? "text-[#D4145A]"
        : "text-[#51434B] hover:text-[#D4145A]"
    }`;

  const handleSearch = (e) => {
    e.preventDefault();
    if (!search.trim()) return;

    navigate(`/search?query=${encodeURIComponent(search.trim())}`);
    setOpen(false);
  };

  const closeMenu = () => setOpen(false);

  const loginClass =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-[#D4145A] to-[#FF7628] px-[18px] py-2 text-[12px] font-semibold font-poppins text-white shadow-sm transition hover:brightness-105";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#F4E5EB] bg-white">
      <div className="mx-auto flex min-h-[68px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:gap-4 lg:px-10">

        {/* Logo */}
        <Link
          to="/"
          onClick={closeMenu}
          className="flex shrink-0 items-center gap-0"
          aria-label="HarEvent Home"
        >
          <img
            src="/logoForm.jpeg"
            alt=""
            className="h-16 w-16 object-contain"
          />
     <span
          style={{ fontFamily: '"Playfair Display", serif' }}
           className="bg-gradient-to-r from-[#E50059] to-[#FF8429] bg-clip-text !text-[25px] !font-bold leading-none text-transparent"
       >
  HarEvent
</span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden items-center gap-1 xl:ml-auto xl:flex 2xl:gap-2"
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={linkClass}
            >
              {link.name}
            </NavLink>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="hidden shrink-0 items-center gap-2 md:flex xl:ml-2">

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="flex h-9 w-[220px] items-center gap-2 rounded-full border border-[#F0DDE5] bg-[#FFF7FA] px-3 focus-within:border-[#D4145A] 2xl:w-[240px]"
          >
            <Search
              size={16}
              className="shrink-0 text-[#907D87]"
            />

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, vendors or locations..."
              aria-label="Search events, vendors or locations"
              className="min-w-0 flex-1 bg-transparent !text-[12px] font-poppins text-[#453640] outline-none placeholder:text-[#9A8992]"
            />
          </form>

          {/* Login */}
          {onLoginClick ? (
            <button
              type="button"
              onClick={onLoginClick}
              className={loginClass}
            >
              <UserRound size={16} aria-hidden="true" />
              Login
            </button>
          ) : (
            <Link to="/login" className={loginClass}>
              <UserRound size={14} aria-hidden="true" />
              Login
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F0DDE5] text-[#D4145A] xl:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {open && (
        <div className="border-t border-[#F0DDE5] bg-white px-4 pb-5 pt-4 shadow-lg xl:hidden">

          {/* Mobile Search */}
          <form
            onSubmit={handleSearch}
            className="mb-4 flex h-11 items-center gap-2 rounded-full border border-[#F0DDE5] bg-[#FFF7FA] px-3"
          >
            <Search size={17} className="text-[#D4145A]" />

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, vendors or locations..."
              aria-label="Search events, vendors or locations"
              className="min-w-0 flex-1 bg-transparent text-sm font-poppins outline-none placeholder:text-[#9A8992]"
            />
          </form>

          {/* Mobile Links */}
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-3 !text-[14px] !font-medium font-poppins ${
                    isActive
                      ? "text-[#D4145A]"
                      : "text-[#51434B] hover:bg-[#FFF7FA]"
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          {/* Mobile Login */}
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#F0DDE5] pt-4">
            {onLoginClick ? (
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  onLoginClick();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4145A] to-[#FF7628] px-3 py-3 text-center text-sm font-semibold font-poppins text-white"
              >
                <UserRound size={16} aria-hidden="true" />
                Login
              </button>
            ) : (
              <Link
                to="/login"
                onClick={closeMenu}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4145A] to-[#FF7628] px-3 py-3 text-center text-sm font-semibold font-poppins text-white"
              >
                <UserRound size={16} aria-hidden="true" />
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
