import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/session";
import { loadSettings } from "@/lib/admin/settings";
import { saveSettingsAction } from "../../actions";
import { Flash, NoDb, PageHead, type SP } from "../../_components/ui";

export const metadata = { title: "Settings" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const instant = false;

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const s = db ? await loadSettings(db) : null;
  const flags = s ? Object.entries(s.featureFlags).map(([k, v]) => `${k}=${v}`).join("\n") : "";
  return (
    <>
      <PageHead title="Settings" sub="Stored in the settings table. Saving is audited." />
      <Flash sp={sp} />
      {!s ? (
        <NoDb />
      ) : (
        <form action={saveSettingsAction} className="adm-card adm-form">
          <label>
            Default theme
            <select name="theme" defaultValue={s.defaultTheme}>
              <option value="dark">Dark</option>
              <option value="grey">Grey</option>
            </select>
          </label>
          <label>
            Feature flags (one per line, key=true or key=false)
            <textarea name="flags" rows={6} defaultValue={flags} className="adm-mono" />
          </label>
          <label>
            Alert email recipients (comma or one per line)
            <textarea name="recipients" rows={3} defaultValue={s.alertRecipients.join("\n")} />
          </label>
          <button className="adm-btn adm-btn-primary" type="submit">Save settings</button>
        </form>
      )}
    </>
  );
}
