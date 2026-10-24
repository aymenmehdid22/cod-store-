import { google } from "googleapis";

export type SheetOrder = {
  orderNumber: string;
  createdAt: string;
  productName: string;
  variantName: string;
  quantity: number;
  customerName: string;
  phone: string;
  wilayaName: string;
  deliveryType: "home" | "stopdesk";
  commune: string;
  address: string;
  stopdesk: string;
  unitPrice: number;
  totalPrice: number;
  status: string;
  utmSource: string;
  utmCampaign: string;
};

// Appends a row to the "Orders" sheet. Returns false instead of throwing —
// Google Sheets must never break the order flow.
export async function appendOrderToSheet(order: SheetOrder): Promise<boolean> {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!spreadsheetId || !email || !key) return false;

    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const d = new Date(order.createdAt);
    const date = d.toLocaleDateString("fr-DZ", { timeZone: "Africa/Algiers" });
    const time = d.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Orders!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            order.orderNumber,
            date,
            time,
            order.productName,
            order.variantName,
            order.quantity,
            order.customerName,
            order.phone,
            order.wilayaName,
            order.deliveryType === "home" ? "Domicile" : "Stopdesk",
            order.commune,
            order.address,
            order.stopdesk,
            order.unitPrice,
            order.totalPrice,
            order.status,
            order.utmSource,
            order.utmCampaign,
          ],
        ],
      },
    });
    return true;
  } catch (e) {
    console.error("Google Sheets sync failed (non-blocking):", e);
    return false;
  }
}