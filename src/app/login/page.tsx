import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <LoginForm />
      <p className="text-muted-foreground text-sm">
        No account?{" "}
        <Link href="/register" className="underline">
          Register
        </Link>
      </p>
    </main>
  );
}
