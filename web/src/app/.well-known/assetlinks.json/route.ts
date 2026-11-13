/**
 * Proves to Android that the Reenite app and this site belong together, so the app opens the site
 * full screen with no browser address bar. Without a matching fingerprint the app still works, but shows the bar.
 *
 * ANDROID_SHA256_FINGERPRINTS: comma-separated SHA-256 certificate fingerprints, from
 * Play Console > Test and release > App integrity > App signing (the app signing key and the upload key).
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const statements = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: process.env.ANDROID_PACKAGE_NAME || "com.reenite.app", sha256_cert_fingerprints: fingerprints },
        },
      ]
    : [];

  return Response.json(statements, { headers: { "Cache-Control": "public, max-age=3600" } });
}
