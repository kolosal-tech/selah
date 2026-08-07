import { supabaseServer } from "@/lib/supabase/server";
import { PrayerClientView, type PrayerItem } from "./page-client";

export default async function PrayerPage() {
  const supabase = await supabaseServer();
  const { data: requests } = await supabase
    .from("prayer_requests")
    .select("*, profiles!prayer_requests_author_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(50);

  return <PrayerClientView initialRequests={(requests ?? []) as PrayerItem[]} />;
}

