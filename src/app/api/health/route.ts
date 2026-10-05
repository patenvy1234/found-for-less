export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "affiliate-storefront",
      version: process.env.DEPLOYMENT_VERSION ?? "local",
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}