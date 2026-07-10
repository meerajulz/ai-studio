import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/** Entry point — send authenticated users to the app, everyone else to login. */
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session ? "/projects" : "/login");
}
