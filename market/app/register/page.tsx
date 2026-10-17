import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Créer un compte" };

export default function RegisterPage() {
  return (
    <>
      <h1>Créer un compte</h1>
      <RegisterForm />
    </>
  );
}
