import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1>Connexion</h1>
      <LoginForm next={next} />
    </>
  );
}
