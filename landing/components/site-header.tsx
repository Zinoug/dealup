import { NAVIGATION } from "@/lib/site";
import Link from "next/link";
import { AppStoreButton } from "./app-store-button";
import { Brand } from "./brand";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Brand compact />
        <nav aria-label="Navigation principale" className="site-nav">
          {NAVIGATION.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__cta">
          <AppStoreButton location="header" theme="light" />
        </div>
      </div>
    </header>
  );
}

