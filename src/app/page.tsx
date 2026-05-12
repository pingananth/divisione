import Header from "@/components/Header";
import Hero from "@/components/Hero";
import NoticeBoard from "@/components/NoticeBoard";
import MiniCalendar from "@/components/MiniCalendar";
import OfficerToolkit from "@/components/OfficerToolkit";
import KnowYourDivision from "@/components/KnowYourDivision";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-grow">
        <Hero />
        <NoticeBoard />
        <MiniCalendar />
        <OfficerToolkit />
        <KnowYourDivision />
      </main>
      <Footer />
    </>
  );
}
