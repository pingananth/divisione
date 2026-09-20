import { DemoBanner } from "@/components/DemoBanner";

/**
 * The demo warning belongs on the registration routes only. In the root layout
 * it would put "no database connected, do not pay" across every page of the
 * site, including the ordinary content pages, whenever demo mode is on.
 */
export default function RegistrationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      {children}
    </>
  );
}
