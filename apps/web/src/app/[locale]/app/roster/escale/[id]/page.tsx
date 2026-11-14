"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";

/** Layovers moved out of the roster: old links land on the new page. */
export default function OldLayoverLink() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => router.replace({ pathname: "/app/escales/[id]", params: { id } }), [id, router]);
  return null;
}
