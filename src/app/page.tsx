import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ConverterCard } from "@/components/ConverterCard";

export default function Home() {
  return (
    <div className="bg-pattern min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <ConverterCard />
      </main>

      <Footer />
    </div>
  );
}
