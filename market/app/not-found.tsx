import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getDictionary();
  return (
    <>
      <h1>{t.notFound.title}</h1>
      <p>{t.notFound.text}</p>
      <Link href="/resources">{t.notFound.back}</Link>
    </>
  );
}
