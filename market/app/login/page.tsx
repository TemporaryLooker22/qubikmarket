import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="card mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Connexion</h1>
      <LoginForm next={next} />
    </div>
  );
}
