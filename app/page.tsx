// app/page.tsx
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import { HowItWorks, Features, FinalCta, Footer } from "@/components/landing/sections";

export const metadata = {
  title: "Nakami · Describe the vibe, get the whole look",
  description:
    "Nakami curates real items across retailers into one shoppable board, with a single PayPal checkout.",
};

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