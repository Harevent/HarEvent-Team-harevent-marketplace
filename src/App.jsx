import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";

import About from "./pages/About";
import Blogs from "./pages/Blogs";
import Contact from "./pages/Contact";
import Enquiry from "./pages/Enquiry";
import EventCategories from "./pages/EventCategories";
import EventPlanners from "./pages/EventPlanners";
import Favorites from "./pages/Favorites";
import Home from "./pages/Home";
import JoinAsVendor from "./pages/JoinAsVendor";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import Search from "./pages/Search";
import VendorCategories from "./pages/VendorCategories";

function App() {
  return (
    <BrowserRouter>
      <>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/event-planners" element={<EventPlanners />} />
          <Route path="/event-categories" element={<EventCategories />} />
          <Route path="/vendor-categories" element={<VendorCategories />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/enquiry" element={<Enquiry />} />
          <Route path="/login" element={<Login />} />
          <Route path="/vendor-login" element={<Login initialMode="vendor" />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/join-as-vendor" element={<JoinAsVendor />} />
          <Route path="/search" element={<Search />} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        <a
          href="https://wa.me/917448181396"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          title="Chat with us on WhatsApp"
          className="fixed bottom-7 right-7 z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-[#12B886] text-white shadow-lg shadow-emerald-900/20 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#12B886] max-sm:bottom-4 max-sm:right-4 motion-reduce:transition-none"
        >
          <span className="absolute inset-0 -z-10 rounded-full bg-[#12B886]/40 motion-safe:animate-ping motion-reduce:animate-none" aria-hidden="true" />
          <FaWhatsapp size={32} aria-hidden="true" />
          <span className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-white bg-[#12B886]" aria-hidden="true" />
        </a>
      </>
    </BrowserRouter>
  );
}

export default App;
