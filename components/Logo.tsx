import Image from "next/image";

/**
 * The portal emblem (engraved cap, scroll and open book). Rendered from the
 * pre-sized PNGs in public/images; the white background is part of the mark.
 */
export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  const src = size > 128 ? "/images/logo-512.png" : size > 64 ? "/images/logo-256.png" : "/images/logo-128.png";
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-md bg-white ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
