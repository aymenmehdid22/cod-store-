export default function AnnouncementBar({ text, enabled }: { text: string; enabled: boolean }) {
  if (!enabled || !text.trim()) return null;
  return (
    <div role="region" aria-label="Annonce" className="bg-foreground px-4 py-2 text-center text-xs font-semibold text-white">
      {text}
    </div>
  );
}
