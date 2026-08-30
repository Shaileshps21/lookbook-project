import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wand2 } from "lucide-react";
import BookRow from "./BookRow";
import Loader from "../common/Loader";
import { fetchHomepage } from "../../services/homepageService";
import { useAuth } from "../../hooks/useAuth";
import type { Homepage } from "../../types";

const ColdStartCTA = () => (
  <section className="pt-4 pb-2 bg-[#F5F2EA]">
    <div className="max-w-7xl mx-auto px-6">
      <div className="rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 text-white p-8 flex items-center justify-between gap-6 flex-wrap shadow-lg shadow-amber-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Wand2 size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Tell us what you love to read</h3>
            <p className="text-white/90 text-sm mt-0.5">Pick a few favorite genres and authors — we'll tailor this whole page to you.</p>
          </div>
        </div>
        <Link
          to="/onboarding"
          className="bg-white text-amber-700 font-semibold px-6 py-3 rounded-full whitespace-nowrap hover:bg-amber-50 transition"
        >
          Personalize My Feed
        </Link>
      </div>
    </div>
  </section>
);

const PersonalizedSections = () => {
  const { user, initializing } = useAuth();
  const [homepage, setHomepage] = useState<Homepage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initializing) return;
    fetchHomepage()
      .then(setHomepage)
      .catch(() => setHomepage(null))
      .finally(() => setLoading(false));
  }, [initializing, user?.id]);

  if (loading) {
    return (
      <section className="py-16 bg-[#F5F2EA]">
        <Loader label="Personalizing your homepage..." />
      </section>
    );
  }

  if (!homepage) return null;

  const isPersonalized = !homepage.coldStart;

  return (
    <>
      {homepage.coldStart && user && <ColdStartCTA />}

      <BookRow
        eyebrow="Pick Up Where You Left Off"
        title="Continue Reading"
        books={homepage.continueReading}
        personalized
        section="Continue Reading"
        arm={homepage.arm}
        reasons={homepage.reasons}
      />
      <BookRow
        eyebrow="Recommended"
        title="Recommended For You"
        books={homepage.recommendedForYou}
        personalized
        section="Recommended For You"
        arm={homepage.arm}
        reasons={homepage.reasons}
      />
      {homepage.becauseYouRead.sourceBook && (
        <BookRow
          eyebrow="Because You Read"
          title={`Because You Read ${homepage.becauseYouRead.sourceBook.title}`}
          books={homepage.becauseYouRead.books}
          personalized
          section="Because You Read"
          arm={homepage.arm}
          reasons={homepage.reasons}
        />
      )}
      <BookRow
        eyebrow="Trending Now"
        title={homepage.coldStart ? "Popular With Readers" : "Popular In Your Favourite Genre"}
        books={homepage.popularInGenre}
        viewMoreHref="/categories"
        personalized={isPersonalized}
        section="Trending Now"
        arm={homepage.arm}
        reasons={homepage.reasons}
      />
      <BookRow eyebrow="Recently Viewed" title="Recently Viewed" books={homepage.recentlyViewed} personalized section="Recently Viewed" arm={homepage.arm} reasons={homepage.reasons} />
      <BookRow eyebrow="Just Added" title="New Releases" books={homepage.newReleases} viewMoreHref="/categories" />
      <BookRow
        eyebrow="Wishlist Picks"
        title="Similar To Your Wishlist"
        books={homepage.similarToWishlist}
        personalized
        section="Similar To Your Wishlist"
        arm={homepage.arm}
        reasons={homepage.reasons}
      />
    </>
  );
};

export default PersonalizedSections;
