import { NAVIGATION } from "@/lib/site";
import Link from "next/link";
import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Brand />
          <p>La décision plus claire avant d’acheter un appareil Apple d’occasion.</p>
          <span>Disponible sur iPhone au lancement.</span>
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
            <strong>DealUp</strong>
            <Link href="/#faq">Questions fréquentes</Link>
            <Link href="/appareils-compatibles/">Compatibilité</Link>
            <a href="mailto:contact@joindealup.com">Contact</a>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} DealUp</span>
        <p>DealUp est indépendant et n’est ni affilié ni approuvé par Leboncoin ou Apple.</p>
      </div>
    </footer>
  );
}

