import { motion } from "framer-motion";
import {
  BookOpen,
  Truck,
  Wallet,
  RefreshCcw,
} from "lucide-react";

const cards = [
  {
    title: "50,000+ Books",
    description:
      "Explore fiction, non-fiction, academics, biographies and more.",
    icon: BookOpen,
    large: true,
  },

  {
    title: "Fast Delivery",
    description:
      "Quick and reliable doorstep delivery.",
    icon: Truck,
  },

  {
    title: "Save Money",
    description:
      "Rent books at a fraction of purchase cost.",
    icon: Wallet,
  },

  {
    title: "Rent • Buy • Sell",
    description:
      "One platform for every reader's need.",
    icon: RefreshCcw,
    large: true,
  },
];

const WhyChoose = () => {
  return (
    <section className="py-24 bg-[#F5F2EA]">

      <div className="max-w-7xl mx-auto px-6">

        {/* Heading */}

        <div className="text-center mb-14">

          <p className="text-amber-700 font-medium">
            WHY CHOOSE LOOKBOOK
          </p>

          <h2
            className="
            mt-3
            text-4xl
            font-bold
            text-slate-800
            "
          >
            Reading Made Smarter
          </h2>

          <p
            className="
            mt-4
            text-slate-600
            "
          >
            Everything you need for discovering,
            renting, buying and selling books.
          </p>

        </div>

        {/* Bento Grid */}

        <div
          className="
          grid
          md:grid-cols-3
          gap-5
          "
        >
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.title}
                whileHover={{
                  y: -6,
                }}
                className={`
                  bg-white
                  rounded-3xl
                  p-6
                  shadow-sm
                  border
                  border-slate-100
                  hover:shadow-xl
                  transition-all

                  ${
                    card.large
                      ? "md:col-span-2"
                      : ""
                  }
                `}
              >
                <div
                  className="
                  h-full
                  flex
                  flex-col
                  justify-between
                  "
                >
                  <div>

                    <div
                      className="
                      w-12
                      h-12
                      rounded-2xl
                      bg-amber-100
                      flex
                      items-center
                      justify-center
                      "
                    >
                      <Icon
                        size={22}
                        className="text-amber-700"
                      />
                    </div>

                    <h3
                      className="
                      mt-5
                      text-xl
                      font-bold
                      text-slate-800
                      "
                    >
                      {card.title}
                    </h3>

                    <p
                      className="
                      mt-3
                      text-slate-600
                      leading-7
                      "
                    >
                      {card.description}
                    </p>

                  </div>

                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default WhyChoose;