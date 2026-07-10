"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="grid max-w-sm gap-2 rounded-lg border p-4">
      <div className="text-sm">
        <span className="text-muted-foreground">Name:</span> {name}
      </div>
      <div className="text-sm">
        <span className="text-muted-foreground">Email:</span> {email}
      </div>
      <Button variant="outline" onClick={handleSignOut} disabled={loading}>
        {loading ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
