import { proxyFile } from "@/lib/proxy-file";

/** The payments spreadsheet for the chosen range. The API checks the staff member may see reports. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const allowed = new URLSearchParams();
  for (const key of ["preset", "from", "to"]) {
    const value = query.get(key);
    if (value) allowed.set(key, value);
  }
  return proxyFile(`/admin/reports/payments.csv?${allowed}`);
}
