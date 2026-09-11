import { Header } from "@/components/layout/header";
import { Simulateur } from "@/components/simulateur/simulateur";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Simulateur />
      </main>
    </>
  );
}
