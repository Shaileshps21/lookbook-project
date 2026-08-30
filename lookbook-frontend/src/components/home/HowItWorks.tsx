import { motion } from "framer-motion";
import {
  Search,
  ShoppingBag,
  BookOpen,
  RefreshCcw,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Browse Books",
    description:
      "Explore thousands of books across multiple categories.",
    icon: Search,
  },
  {
    number: "02",
    title: "Rent / Buy",
    description:
      "Choose whether to rent or purchase your favorite book.",
    icon: ShoppingBag,
  },
  {
    number: "03",
    title: "Read & Enjoy",
    description:
      "Get your books delivered and start reading instantly.",
    icon: BookOpen,
  },
  {
    number: "04",
    title: "Return or Sell",
    description:
      "Return rented books or sell books back to the community.",
    icon: RefreshCcw,
  },
];

const HowItWorks = () => {
  return (
    <section className="py-28 bg-[#F5F2EA]">
      <div className="max-w-7xl mx-auto px-6">

        {/* Heading */}

        <div className="text-center mb-24">

          <p className="text-amber-700 font-semibold tracking-[0.2em] uppercase">
            How It Works
          </p>

          <h2 className="mt-4 text-5xl font-bold text-slate-900">
            Reading Made Easy
          </h2>

          <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
            A seamless journey from discovering books
            to completing your next great read.
          </p>

        </div>

        {/* Timeline */}

        <div className="relative">

          {/* Main Line */}

          <div
            className="
            hidden md:block
            absolute
            top-8
            left-[12%]
            right-[12%]
            h-[4px]
            rounded-full
            bg-gradient-to-r
            from-amber-300
            via-amber-500
            to-amber-300
            "
          />

          <div className="grid md:grid-cols-4 gap-10">

            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.number}
                  initial={{
                    opacity: 0,
                    y: 30,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.15,
                  }}
                  className={`
                    relative text-center
                    ${index % 2 !== 0 ? "md:mt-12" : ""}
                  `}
                >
                  {/* Large Background Number */}

                  <span
                    className="
                    absolute
                    -top-10
                    left-1/2
                    -translate-x-1/2
                    text-7xl
                    font-black
                    text-amber-300/30
                    select-none
                    pointer-events-none
                    "
                  >
                    {step.number}
                  </span>

                  {/* Icon Circle */}

                  <motion.div
                    whileHover={{
                      scale: 1.08,
                    }}
                    className="
                    relative
                    z-10
                    w-16
                    h-16
                    mx-auto
                    rounded-full
                    bg-white
                    border
                    border-amber-100
                    shadow-lg
                    flex
                    items-center
                    justify-center
                    "
                  >
                    <Icon
                      size={24}
                      className="text-amber-700"
                    />
                  </motion.div>

                  {/* Arrow */}

                  {index !== steps.length - 1 && (
                    <div
                      className="
                      hidden md:flex
                      absolute
                      top-6
                      -right-8
                      z-20
                      "
                    >
                      <ArrowRight
                        size={20}
                        className="text-amber-500"
                      />
                    </div>
                  )}

                  {/* Content Card */}

                  <motion.div
                    whileHover={{
                      y: -6,
                    }}
                    className="
                    mt-6
                    bg-white/80
                    backdrop-blur-sm
                    rounded-2xl
                    p-5
                    border
                    border-white
                    shadow-sm
                    hover:shadow-xl
                    transition-all
                    duration-300
                    "
                  >
                    <p
                      className="
                      text-xs
                      font-semibold
                      tracking-widest
                      text-amber-700
                      uppercase
                      "
                    >
                      Step {step.number}
                    </p>

                    <h3
                      className="
                      mt-3
                      text-xl
                      font-bold
                      text-slate-900
                      "
                    >
                      {step.title}
                    </h3>

                    <p
                      className="
                      mt-3
                      text-slate-600
                      leading-7
                      text-sm
                      "
                    >
                      {step.description}
                    </p>
                  </motion.div>
                </motion.div>
              );
            })}

          </div>

        </div>

      </div>
    </section>
  );
};

export default HowItWorks;