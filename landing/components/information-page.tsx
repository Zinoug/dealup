import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type InformationPageProps = {
  children: ReactNode;
  eyebrow: string;
  intro: string;
  title: string;
  updated?: string;
};

export function InformationPage({
  children,
  eyebrow,
  intro,
  title,
  updated,
}: InformationPageProps) {
  return (
    <>
      <SiteHeader />
      <main className="information-page">
        <header className="information-page__hero">
          <div className="page-container">
            <span>{eyebrow}</span>
            <h1>{title}</h1>
            <p>{intro}</p>
            {updated ? <small>Dernière mise à jour : {updated}</small> : null}
          </div>
        </header>
        <article className="page-container information-page__content">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
