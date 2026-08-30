import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Briefcase,
  Compass,
  FlaskConical,
  Heart,
  Landmark,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCategories } from "../../hooks/useCategories";
import Loader from "../common/Loader";

/**
 * Category cover art was cleared from the DB in the 2026-08-18 hotfix (the
 * old values pointed at static paths that no longer exist), so every card
 * fell back to a blank gradient rectangle that read as a broken image rather
 * than an icon. Fallback: a small fanned stack of 3 book spines, one hue per
 * genre — reads as "a shelf of this genre" rather than a broken cover, and
 * needs no image hosting. `Compass`/slate covers any genre added later.
 *
 * Tailwind's scanner needs literal class names (not string-built ones), so
 * these are spelled out per shade rather than templated from a color name.
 */
interface GenreTheme {
  icon: LucideIcon;
  spineBack: string; // left spine, furthest back
  spineFront: string; // right spine, furthest back
  spineMain: string; // center spine, on top — carries the icon
}

const CATEGORY_THEMES: Record<string, GenreTheme> = {
  business: { icon: Briefcase, spineBack: "bg-indigo-300", spineFront: "bg-indigo-500", spineMain: "bg-indigo-700" },
  fiction: { icon: BookOpen, spineBack: "bg-fuchsia-300", spineFront: "bg-fuchsia-500", spineMain: "bg-fuchsia-700" },
  history: { icon: Landmark, spineBack: "bg-amber-300", spineFront: "bg-amber-500", spineMain: "bg-amber-700" },
  romance: { icon: Heart, spineBack: "bg-rose-300", spineFront: "bg-rose-500", spineMain: "bg-rose-700" },
  science: { icon: FlaskConical, spineBack: "bg-teal-300", spineFront: "bg-teal-500", spineMain: "bg-teal-700" },
  "self help": { icon: Sparkles, spineBack: "bg-emerald-300", spineFront: "bg-emerald-500", spineMain: "bg-emerald-700" },
};

const FALLBACK_THEME: GenreTheme = {
  icon: Compass,
  spineBack: "bg-slate-300",
  spineFront: "bg-slate-500",
  spineMain: "bg-slate-700",
};

const themeFor = (name: string): GenreTheme => CATEGORY_THEMES[name.trim().toLowerCase()] ?? FALLBACK_THEME;

/** A small fanned stack of 3 book spines standing on a shared baseline. */
const BookStack = ({ category }: { category: string }) => {
  const theme = themeFor(category);
  const Icon = theme.icon;
  return (
    <div className="relative h-20 w-16 flex items-end justify-center">
      <div
        className={`absolute bottom-0 left-1 h-14 w-4 rounded-sm shadow-md -rotate-[14deg] origin-bottom ${theme.spineBack}`}
      />
      <div
        className={`absolute bottom-0 right-1 h-14 w-4 rounded-sm shadow-md rotate-[14deg] origin-bottom ${theme.spineFront}`}
      />
      <div
        className={`relative z-10 h-20 w-5 rounded-sm shadow-lg flex items-start justify-center pt-2 ${theme.spineMain}`}
      >
        <Icon size={13} strokeWidth={2} className="text-white/90" aria-hidden="true" />
      </div>
    </div>
  );
};

const PopularCategories = () => {
  const navigate = useNavigate();
  const { categories, loading } = useCategories();

  if (loading) {
    return (
      <section className="py-24 bg-[#F5F2EA]">
        <Loader label="Loading categories..." />
      </section>
    );
  }

  return (
    <section className="py-24 bg-[#F5F2EA]">
      <div className="max-w-6xl mx-auto px-6">

        {/* Heading */}

        <div className="text-center mb-14">

          <p
            className="
            text-amber-700
            font-medium
            uppercase
            tracking-[0.2em]
            "
          >
            Explore
          </p>

          <h2
            className="
            mt-3
            text-4xl
            md:text-5xl
            font-bold
            text-slate-900
            "
          >
            Popular Categories
          </h2>

          <p
            className="
            mt-4
            text-slate-600
            "
          >
            Browse books from your favorite genres.
          </p>

        </div>

        {/* Cards */}

        <div
          className="
          grid
          sm:grid-cols-2
          lg:grid-cols-3
          gap-5
          "
        >

          {categories.map((category) => (
            <motion.button
              key={category.id}
              onClick={() => navigate(`/categories?category=${encodeURIComponent(category.name)}`)}
              whileHover={{
                y: -6,
              }}
              whileTap={{
                scale: 0.98,
              }}
              className="
              group
              bg-white
              rounded-3xl
              border
              border-amber-100
              p-5
              shadow-sm
              hover:shadow-xl
              hover:border-amber-300
              transition-all
              duration-300
              text-left
              "
            >

              {/* Mini Cover — real cover art when a category has one,
                  otherwise a fanned book-stack (see BookStack above). */}

              <div className="flex justify-center mb-8 group-hover:-translate-y-2 transition-all duration-300">

                {category.image ? (
                  <img
                    src={category.image}
                    alt=""
                    className="
                    h-20
                    w-14
                    object-cover
                    rounded-lg
                    shadow-md
                    "
                  />
                ) : (
                  <BookStack category={category.name} />
                )}

              </div>

              {/* Category Name */}

              <h3
                className="
                text-2xl
                font-bold
                text-slate-900
                "
              >
                {category.name}
              </h3>

              {/* Count */}

              <p
                className="
                mt-2
                text-slate-500
                "
              >
                {category.count.toLocaleString("en-IN")}+ Books
              </p>

              {/* Explore */}

              <div
                className="
                mt-4
                flex
                items-center
                gap-2
                text-amber-700
                font-medium
                "
              >
                Explore

                <span
                  className="
                  group-hover:translate-x-1
                  transition
                  "
                >
                  →
                </span>

              </div>

            </motion.button>
          ))}

        </div>

      </div>
    </section>
  );
};

export default PopularCategories;