import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="not-found">
      <span>404</span>
      <h1>Ce détail nous a échappé.</h1>
      <p>La page demandée n’existe pas ou a été déplacée.</p>
      <Link href="/">Revenir à l’accueil <ArrowRightIcon /></Link>
    </main>
  );
}
