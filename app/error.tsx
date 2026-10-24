"use client";

import { useEffect } from "react";

// Generic error state: never shows technical details to the visitor.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error.digest ?? "", error.message); }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold">Une erreur est survenue · حدث خطأ</h1>
      <button type="button" onClick={reset} className="btn-primary">Réessayer · إعادة المحاولة</button>
    </main>
  );
}
