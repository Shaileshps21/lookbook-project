import Hero from "../components/home/Hero";
import PersonalizedSections from "../components/home/PersonalizedSections";
import PopularCategories from "../components/home/PopularCategories";
import WhyChoose from "../components/home/WhyChoose";
import HowItWorks from "../components/home/HowItWorks";
import CTA from "../components/home/CTA";

const HomePage = () => {
  return (
    <>
      <Hero />
      <PersonalizedSections />
      <PopularCategories />
      <WhyChoose />
      <HowItWorks />
      <CTA />
    </>
  );
};

export default HomePage;
