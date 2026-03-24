import Image from "next/image";

interface UserAvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

function getUserInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 48% 38%)`;
}

export function UserAvatar({
  name,
  imageUrl,
  size = 30,
  className = "",
}: UserAvatarProps) {
  const safeName = name?.trim() || "User";

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border border-slate-600 text-slate-100 ${className}`.trim()}
      style={{ width: size, height: size, backgroundColor: getAvatarColor(safeName) }}
      aria-hidden="true"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          className="select-none font-semibold leading-none"
          style={{ fontSize: Math.max(10, Math.floor(size * 0.42)) }}
        >
          {getUserInitials(safeName)}
        </span>
      )}
    </div>
  );
}
