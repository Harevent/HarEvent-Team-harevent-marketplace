import {
  Search,
  Scale,
  MessagesSquare,
  CalendarCheck,
  PartyPopper,
} from "lucide-react";
import { motion } from "framer-motion";

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "SEARCH",
      description:
        "Find event professionals based on your occasion, service requirements, and preferred location.",
      icon: Search,
      color: "pink",
    },
    {
      number: "02",
      title: "COMPARE",
      description:
        "Explore portfolios, services, ratings, and available pricing information to understand your options.",
      icon: Scale,
      color: "pink",
    },
    {
      number: "03",
      title: "CONNECT",
      description:
        "Reach out to the professionals who match your vision and discuss your requirements directly.",
      icon: MessagesSquare,
      color: "pink",
    },
    {
      number: "04",
      title: "BOOK",
      description:
        "Finalize your preferred services and booking arrangements with the selected vendor.",
      icon: CalendarCheck,
      color: "pink",
    },
    {
      number: "05",
      title: "CELEBRATE",
      description:
        "Bring your plans together and create moments worth remembering.",
      icon: PartyPopper,
      color: "orange",
    },
  ];

  return (
    <section className="w-full bg-[#FFF6F8] py-12 sm:py-16 overflow-hidden">
      <div className="mx-auto w-full px-5 sm:px-8 lg:px-12 max-w-[1320px]">
        
        {/* Section Heading - Har baar scroll karne par animate hoga */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="h-[2px] w-6 bg-[#D4145A]" />
            <span className="font-poppins text-[13px] font-bold uppercase tracking-[1.5px] text-[#D4145A]">
              How It Works
            </span>
            <span className="h-[2px] w-6 bg-[#D4145A]" />
          </div>

          <h2 className="font-playfair text-2xl font-bold tracking-tight text-[#38232F] sm:text-3xl lg:text-4xl">
            How HarEvent Works
          </h2>

          <p className="mx-auto mt-2 max-w-2xl font-poppins text-[15px] leading-6 text-[#8C7883] sm:text-[16px]">
            Planning an event starts with the right connections. HarEvent
            makes it easier to discover professionals, explore your options,
            and plan with confidence.
          </p>
        </motion.div>

        {/* Steps Container */}
        <div className="relative mx-auto mt-12 w-full max-w-[1200px]">
          
          {/* Connecting Line (Desktop) */}
          <div className="absolute left-[8%] right-[8%] top-[30px] hidden h-[2px] bg-gradient-to-r from-[#F4B4CD] via-[#F7A9C6] to-[#FFC18D] md:block" />

          <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-5 md:gap-4">
            {steps.map(({ number, title, description, icon: Icon, color }, index) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                // Yahan once: false karne se jab bhi user upar-neeche scroll karega, animation fir se chalegi
                viewport={{ once: false, margin: "-50px" }}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.12, 
                  ease: "easeOut" 
                }}
                className="flex flex-col items-center text-center group"
              >
                {/* Icon Circle */}
                <div className="relative mb-4">
                  <div
                    className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:shadow-lg ${
                      color === "orange"
                        ? "bg-[#FF790D]"
                        : "bg-[#E60059]"
                    }`}
                  >
                    <Icon size={21} strokeWidth={2} />
                  </div>

                  {/* Step Number */}
                  <span
                    className={`absolute -right-1 -top-1 z-20 flex h-[20px] min-w-[22px] items-center justify-center rounded-full border border-white px-1 font-poppins text-[13px] font-bold shadow-sm ${
                      number === "05"
                        ? "bg-gradient-to-r from-[#E60059] to-[#FF790D] text-white"
                        : "bg-white text-[#D4145A]"
                    }`}
                  >
                    {number}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-poppins text-[16px] font-bold tracking-wide text-[#3E2A35] transition-colors duration-200 group-hover:text-[#D4145A]">
                  {title}
                </h3>

                {/* Description */}
                <p className="mt-1.5 max-w-[220px] font-poppins text-[14px] font-normal leading-[1.6] text-[#8C7883]">
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;