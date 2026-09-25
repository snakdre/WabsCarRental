import { Hero } from "@/components/customer/home/hero";
import { FeaturedVehicles } from "@/components/customer/home/featured-vehicles";
import { Categories } from "@/components/customer/home/categories";
import { HowItWorks } from "@/components/customer/home/how-it-works";
import { Testimonials } from "@/components/customer/home/testimonials";
import { Faq } from "@/components/customer/home/faq";
import { Newsletter } from "@/components/customer/home/newsletter";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedVehicles />
      <Categories />
      <HowItWorks />
      <Testimonials />
      <Faq />
      <Newsletter />
    </>
  );
}
