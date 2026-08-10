import { supabaseServer } from "@/lib/supabase/server";
import { PrayerClientView, type PrayerItem } from "./page-client";

export default async function PrayerPage() {
  const supabase = await supabaseServer();
  const { data: requests } = await supabase
    .from("prayer_requests_public")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return <PrayerClientView initialRequests={(requests ?? []) as PrayerItem[]} />;
}
