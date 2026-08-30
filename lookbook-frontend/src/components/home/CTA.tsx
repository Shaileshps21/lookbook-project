import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";

const CTA = () => {
  return (
    <section className="bg-[#F5F2EA] py-24">

      <div className="max-w-6xl mx-auto px-6">

        <div
          className="
          relative
          overflow-hidden
          rounded-[40px]
          bg-gradient-to-r
          from-slate-950
          via-slate-900
          to-slate-950
          px-8
          py-20
          text-center
          shadow-2xl
          "
        >

          {/* Glow Effect */}

          <div
            className="
            absolute
            top-1/2
            left-1/2
            -translate-x-1/2
            -translate-y-1/2
            w-[500px]
            h-[500px]
            bg-amber-500/10
            blur-3xl
            rounded-full
            "
          />

          {/* Floating Book 1 */}

          <motion.div
            animate={{
              y: [0, -15, 0],
              rotate: [-5, 5, -5],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
            }}
            className="
            absolute
            left-10
            top-10
            hidden
            md:flex
            "
          >
            <div
              className="
              w-20
              h-28
              rounded-xl
              border
              border-amber-500/20
              bg-amber-500/10
              backdrop-blur-md
              "
            />
          </motion.div>

          {/* Floating Book 2 */}

          <motion.div
            animate={{
              y: [0, 15, 0],
              rotate: [5, -5, 5],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
            }}
            className="
            absolute
            right-16
            top-16
            hidden
            md:flex
            "
          >
            <div
              className="
              w-20
              h-28
              rounded-xl
              border
              border-amber-500/20
              bg-amber-500/10
              backdrop-blur-md
              "
            />
          </motion.div>

          {/* Floating Book 3 */}

          <motion.div
            animate={{
              y: [0, -12, 0],
              rotate: [8, -8, 8],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
            }}
            className="
            absolute
            right-40
            bottom-10
            hidden
            md:flex
            "
          >
            <div
              className="
              w-16
              h-24
              rounded-xl
              border
              border-amber-500/20
              bg-amber-500/10
              backdrop-blur-md
              "
            />
          </motion.div>

          {/* Center Icon */}

          <motion.div
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
            className="
            relative
            z-10
            w-20
            h-20
            mx-auto
            rounded-full
            bg-amber-500/15
            border
            border-amber-500/20
            flex
            items-center
            justify-center
            "
          >
            <BookOpen
              size={38}
              className="text-amber-400"
            />
          </motion.div>

          {/* Heading */}

          <h2
            className="
            relative
            z-10
            mt-8
            text-4xl
            md:text-5xl
            font-bold
            text-slate-100
            "
          >
            Ready To Start Reading?
          </h2>

          {/* Description */}

          <p
            className="
            relative
            z-10
            mt-6
            max-w-2xl
            mx-auto
            text-slate-300
            text-lg
            leading-8
            "
          >
            Discover thousands of books available
            for rent, purchase and resale.
            Build your personal library without
            breaking the bank.
          </p>

          {/* Buttons */}

          <div
            className="
            relative
            z-10
            mt-10
            flex
            flex-wrap
            justify-center
            gap-4
            "
          >

            <Link
              to="/categories"
              className="
              bg-amber-500
              hover:bg-amber-400
              text-black
              px-8
              py-4
              rounded-full
              font-semibold
              flex
              items-center
              gap-2
              transition-all
              hover:scale-105
              "
            >
              Browse Books

              <ArrowRight size={18} />
            </Link>

            <Link
              to="/sell"
              className="
              border
              border-amber-500/30
              text-amber-300
              px-8
              py-4
              rounded-full
              font-semibold
              flex
              items-center
              gap-2
              hover:bg-amber-500/10
              transition-all
              "
            >
              Sell Books

              <ShoppingBag size={18} />
            </Link>

          </div>

        </div>

      </div>

    </section>
  );
};

export default CTA;