import { unstable_cache } from "next/cache";
import { getTrackRecord } from "./index";

/** The track record, recomputed at most every 5 minutes and after each events sync (tag "stp"). */
export const cachedTrackRecord = unstable_cache(() => getTrackRecord(), ["stp-track-record"], { revalidate: 300, tags: ["stp"] });
