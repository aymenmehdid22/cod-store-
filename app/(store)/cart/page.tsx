import CartView from "@/components/store/CartView";
import { getServerDictionary } from "@/lib/i18n/server";
import { getStoreStrings } from "@/lib/i18n/store-strings";

export const metadata = { robots: { index: false, follow: false } };

export default function CartPage() {
  const s = getStoreStrings(getServerDictionary().locale);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{s.cart.title}</h1>
      <CartView />
    </main>
  );
}
