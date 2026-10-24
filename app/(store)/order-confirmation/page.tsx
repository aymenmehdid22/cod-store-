import { notFound } from "next/navigation";
import ConfirmationView from "@/components/store/ConfirmationView";

export const metadata = { robots: { index: false, follow: false } };

export default function OrderConfirmationPage({ searchParams }: { searchParams: { n?: string } }) {
  const n = searchParams.n ?? "";
  if (!/^[A-Z]{3}-\d{4,10}$/.test(n)) notFound();
  return <main className="px-4 py-10"><ConfirmationView orderNumber={n} /></main>;
}
