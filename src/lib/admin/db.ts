import type { getDb } from "@/lib/db/client";

export type Db = NonNullable<ReturnType<typeof getDb>>;
