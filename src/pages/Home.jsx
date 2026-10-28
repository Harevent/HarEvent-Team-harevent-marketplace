import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import BrandsAndPartners from "../components/BrandsAndPartners";
import Events from "../components/Events";
import FindRightVendor from "../components/FindRightVendor";
import HowItWorks from "../components/HowItWorks";
import PopularVendors from "../components/PopularVendors";
import WhyChooseHarEvent from "../components/WhyChooseHarEvent";
import VendorRegistrationBanner from "../components/VendorRegistrationBanner";
import CustomerAssistance from "../components/CustomerAssistance";
import LatestBlogs from "../components/LatestBlogs";
import Footer from "../components/Footer";
import LoginModal from "../components/LoginModal";

function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedForm = new URLSearchParams(location.search).get("form");
  const loginMode = ["login", "vendor"].includes(requestedForm)
    ? requestedForm
    : null;

  const openLogin = (mode = "login") => {
    navigate(`/?form=${mode}`);
  };

  const closeLogin = () => navigate("/");

  if (requestedForm === "signup" || requestedForm === "vendor-signup") {
    return (
      <Navigate
        to={requestedForm === "vendor-signup" ? "/join-as-vendor" : "/signup"}
        replace
      />
    );
  }

  return (
    <>
      <Navbar onLoginClick={() => openLogin("login")} />
      <Hero />
      <BrandsAndPartners />
      <HowItWorks />
      <Events />
      <FindRightVendor />
      <PopularVendors />
      <WhyChooseHarEvent />
      <VendorRegistrationBanner
        onVendorLoginClick={() => openLogin("vendor")}
        onVendorRegisterClick={() => openLogin("vendor-signup")}
      />
      <CustomerAssistance />
      <LatestBlogs />
      <Footer />
      {loginMode && (
        <LoginModal
          key={loginMode}
          initialMode={loginMode}
          onClose={closeLogin}
          onRegister={(mode) => {
            if (mode === "vendor-signup") navigate("/join-as-vendor");
            else if (mode === "signup") navigate("/signup");
            else openLogin(mode);
          }}
        />
      )}
    </>
  );
}

export default Home;
