import { NotFoundContent, PlainHeader } from "@/components/ErrorPage";
import { SiteFooter } from "@/components/SiteFooter";

// Handles addresses that match no route. Pages inside the site group use (site)/not-found.tsx.
export default function RootNotFound() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <PlainHeader />
      <NotFoundContent />
      <SiteFooter />
    </>
  );
}
