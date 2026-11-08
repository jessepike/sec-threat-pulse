import { unstable_cache } from "next/cache";
import { apiBrief, apiCheckStack } from "./v1";

/** The week's short list, shared by the API route, the MCP tool and the brief feed. */
export const cachedBrief = unstable_cache(() => apiBrief(), ["api-v1-brief"], { revalidate: 300, tags: ["stp"] });

/** Stack checks, keyed by the sorted product list. */
const stackCached = unstable_cache((key: string) => apiCheckStack(key.split("\n")), ["api-v1-check-stack"], { revalidate: 300, tags: ["stp"] });
export const cachedCheckStack = (products: string[]) => stackCached([...products].sort().join("\n")).then((r) => r && { ...r, results: products.map((q) => r.results.find((x) => x.query === q)!) });
