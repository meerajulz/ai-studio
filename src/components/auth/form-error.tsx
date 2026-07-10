import { CircleAlert } from "lucide-react";

/** Inline error banner for auth forms (server errors, etc.). */
export function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
