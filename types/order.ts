export type OrderStatus =
  | "new"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "new", label: "Nouvelle" },
  { value: "confirmed", label: "Confirmée" },
  { value: "processing", label: "En traitement" },
  { value: "shipped", label: "Expédiée" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
  { value: "returned", label: "Retournée" },
];

/** Mirror of public.order_transition_allowed() — the database enforces it; this only drives the UI. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export type Order = {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  customer_name: string;
  phone: string;
  wilaya_code: string;
  wilaya_name: string;
  delivery_type: "home" | "stopdesk";
  commune: string | null;
  address: string | null;
  stopdesk: string | null;
  status: OrderStatus;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  fbclid: string | null;
  google_sheet_synced: boolean;
  subtotal: number | null;
  discount_amount: number;
  discount_code: string | null;
  shipping_fee: number;
  payment_method: string;
  customer_id: string | null;
};
