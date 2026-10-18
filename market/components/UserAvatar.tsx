// Photo de profil d'un membre, ou son initiale s'il n'en a pas (partout sur le site)
export function UserAvatar({ name, src, size = 40, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} loading="lazy" style={style} className={`shrink-0 rounded-full bg-surface object-cover ${className}`} />;
  }
  return (
    <span style={style} className={`flex shrink-0 items-center justify-center rounded-full bg-text font-semibold uppercase text-bg ${className}`} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
