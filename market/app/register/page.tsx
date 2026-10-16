import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Créer un compte" };

export default function RegisterPage() {
  return (
    <div className="card mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Créer un compte</h1>
      <RegisterForm />
    </div>
  );
}
