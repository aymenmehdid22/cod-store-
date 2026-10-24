import type { OrderStatus } from "@/types/order";

const STYLES: Record<OrderStatus, string> = {
  new: "bg-blue-50 text-blue-700",
  confirmed: "bg-purple-50 text-purple-700",
  processing: "bg-amber-50 text-amber-700",
  shipped: "bg-cyan-50 text-cyan-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  returned: "bg-orange-50 text-orange-700",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={
        "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold " +
        STYLES[status]
      }
    >
      {status.toUpperCase()}
    </span>
  );
}
