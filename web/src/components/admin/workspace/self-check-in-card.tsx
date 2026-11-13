import { QrCode } from "@/components/booking/check-in-qr";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SelfCheckInSettings } from "@/lib/types";
import { SelfCheckInControls } from "./self-check-in-controls";

/** Self check-in for one location: the switch, its QR code, and the printable poster. */
export async function SelfCheckInCard({ locationId }: { locationId: number }) {
  const { data: settings } = await api<{ data: SelfCheckInSettings }>(`/admin/workspace/locations/${locationId}/self-check-in`);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Self check-in"
        description="A QR poster at reception so customers can check in without waiting for the front desk."
        action={settings.enabled ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
      />
      <div className="grid gap-6 p-5 sm:grid-cols-[160px_1fr] sm:p-6">
        <div className={settings.enabled ? "" : "opacity-40"}>
          <QrCode value={settings.url} label={`Self check-in QR code for ${settings.location_name}`} className="aspect-square w-40 rounded-xl border border-border bg-white p-3" />
        </div>
        <SelfCheckInControls key={settings.url + String(settings.enabled)} settings={settings} />
      </div>
    </Card>
  );
}
