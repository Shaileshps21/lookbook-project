import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import heroBook from "../../assets/books/book1.jpg";

const Hero = () => {
  return (
    <section
      className="
      relative
      overflow-hidden
      bg-[#F5F2EA]
      min-h-[90vh]
      flex
      items-center
      "
    >
      {/* Background Blobs */}

      <div
        className="
        absolute
        top-20
        left-20
        w-72
        h-72
        bg-amber-200/30
        rounded-full
        blur-3xl
        "
      />

      <div
        className="
        absolute
        bottom-20
        right-20
        w-96
        h-96
        bg-blue-200/20
        rounded-full
        blur-3xl
        "
      />

      <div
        className="
        max-w-7xl
        mx-auto
        px-6
        py-24
        grid
        lg:grid-cols-2
        gap-12
        items-center
        "
      >
        {/* Left */}

        <div>

          <span
            className="
            px-4
            py-2
            rounded-full
            bg-white
            text-[#1E3A5F]
            text-sm
            shadow-sm
            "
          >
            Trusted by 10,000+ Readers
          </span>

          <h1
            className="
            mt-8
            text-5xl
            lg:text-7xl
            font-bold
            text-[#1F2937]
            leading-tight
            "
          >
            Discover Your
            <br />
            Next Favorite
            <span className="text-[#B7791F]">
              {" "}
              Book
            </span>
          </h1>

          <p
            className="
            mt-6
            text-lg
            text-slate-600
            max-w-xl
            leading-8
            "
          >
            Rent, Buy and Sell books through
            a modern platform designed for
            passionate readers, students and
            lifelong learners.
          </p>

          <div
            className="
            flex
            flex-wrap
            gap-4
            mt-10
            "
          >
            <Link
              to="/categories"
              className="
              bg-[#1E3A5F]
              text-white
              px-7
              py-4
              rounded-full
              "
            >
              Browse Books
            </Link>

            <Link
              to="/rent"
              className="
              border
              border-[#1E3A5F]
              px-7
              py-4
              rounded-full
              "
            >
              Start Renting
            </Link>
          </div>

        </div>

        {/* Right */}

        <div
          className="
          relative
          flex
          justify-center
          "
        >
          <motion.img
            animate={{
              y: [0, -15, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
            }}
            src={heroBook}
            alt="Book"
            className="
            w-72
            rounded-3xl
            shadow-2xl
            "
          />

          <motion.div
            animate={{
              y: [0, 10, 0],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
            }}
            className="
            absolute
            -right-10
            top-20
            bg-white
            p-4
            rounded-2xl
            shadow-xl
            "
          >
            ⭐ 4.9 Rating
          </motion.div>

          <motion.div
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
            }}
            className="
            absolute
            -left-10
            bottom-20
            bg-white
            p-4
            rounded-2xl
            shadow-xl
            "
          >
            📚 50,000+ Books
          </motion.div>
        </div>

      </div>
    </section>
  );
};

export default Hero;