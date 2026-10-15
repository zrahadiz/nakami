// app/page.tsx
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import { HowItWorks, Features, FinalCta, Footer } from "@/components/landing/sections";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F6F2EA] text-[#1E1B18]">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}