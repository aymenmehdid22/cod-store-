"use client";
import { useEffect } from "react";
import { track } from "@/lib/tracking";

// Fires Search once per distinct query (the sanitiser drops anything that looks like an email or phone number).
export default function SearchTracker({ query, resultCount }: { query: string; resultCount: number }) {
  useEffect(() => { if (query) track("Search", { search_string: query, num_items: Math.max(1, Math.min(100, resultCount || 1)) }); }, [query, resultCount]);
  return null;
}
