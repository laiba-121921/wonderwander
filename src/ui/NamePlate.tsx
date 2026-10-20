export function NamePlate({ name }: { name: string }) {
  return (
    <span
      className="inline-block -rotate-2 rounded-[10px] bg-grape px-3 py-1 text-small font-bold text-paper-raised"
      style={{ boxShadow: 'var(--sticker)', fontVariationSettings: "'INFM' 80" }}
    >
      {name}
    </span>
  );
}
