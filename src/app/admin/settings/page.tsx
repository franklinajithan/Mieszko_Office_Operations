import { Banner, PageIntro } from "@/components/ui";
import { saveSettings } from "@/server/actions/admin";
import { getOrderSettings } from "@/server/queries";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const query = await searchParams;
  const settings = await getOrderSettings();
  return (
    <>
      <PageIntro title="Order settings" text="A deadline can be shown to stores. Turn on enforcement only when shops should be stopped after that time." />
      <Banner notice={query.notice} error={query.error} />
      <form className="panel formGrid" action={saveSettings}>
        <label className="field">Default deadline<input name="deadline" type="time" defaultValue={settings.deadline} /></label>
        <label className="field">Note for stores<input name="note" defaultValue={settings.note} /></label>
        <label className="check wide"><input type="checkbox" name="enforce" defaultChecked={settings.enforce} /> Stop store submissions after the deadline</label>
        <div className="wide"><button className="button primary" type="submit">Save settings</button></div>
      </form>
    </>
  );
}
