"use client";

import { useParams } from "next/navigation";
import InvoicePage from "@/modules/b2b-marketplace/pages/InvoicePage";

export default function Page() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <InvoicePage id={id} />;
}
