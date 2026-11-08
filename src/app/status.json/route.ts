import { GET as healthGet } from "@/app/api/v1/health/route";

export const dynamic = "force-dynamic";

/** Same report as /api/v1/health, at the address people expect a status page to have. */
export const GET = healthGet;
