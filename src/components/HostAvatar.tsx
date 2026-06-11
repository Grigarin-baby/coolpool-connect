// Host profile picture with a colored first-letter fallback when the host
// hasn't uploaded a photo yet.

export function HostAvatar({
  name,
  photoUrl,
  size = 36,
  className = "",
}: {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name?.trim()?.charAt(0) || "C").toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name ?? "Host"}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 border border-white shadow-sm ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`rounded-full shrink-0 inline-flex items-center justify-center bg-gradient-primary text-white font-bold ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {initial}
    </span>
  );
}
