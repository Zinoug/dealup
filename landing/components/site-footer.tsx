import { NAVIGATION } from "@/lib/site";
import Link from "next/link";
import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Brand />
          <p>La décision plus claire avant d’acheter un appareil d’occasion.</p>
        </div>
        <div className="site-footer__links">
          <div>
            <strong>Découvrir</strong>
            {NAVIGATION.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
          <div>
            <strong>Informations</strong>
            <Link href="/#faq">Questions fréquentes</Link>
            <Link href="/support/">Support</Link>
            <Link href="/confidentialite/">Confidentialité</Link>
            <Link href="/conditions/">Conditions</Link>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} DealUp AI</span>
      </div>
    </footer>
  );
}
