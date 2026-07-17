import Image from "next/image";
import Link from "next/link";

type BrandProps = {
  compact?: boolean;
};

export function Brand({ compact = false }: BrandProps) {
  return (
    <Link className="brand" href="/" aria-label="DealUp — Accueil">
      <Image
        alt=""
        className="brand__icon"
        height={compact ? 38 : 44}
        priority
        src="/dealup-app-icon.png"
        width={compact ? 38 : 44}
      />
      <span className="brand__name">
        Deal<span>Up</span>
      </span>
    </Link>
  );
}

