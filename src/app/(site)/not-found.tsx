import { NotFoundContent } from "@/components/ErrorPage";
import { SiteHeader } from "@/components/SiteHeader";
import { PlainStrip } from "@/components/StatusStrip";
import { getMode } from "@/lib/data";

export default function NotFound() {
  return (
    <>
      <SiteHeader active="none" strip={<PlainStrip mode={getMode()} />} />
      <NotFoundContent />
    </>
  );
}
