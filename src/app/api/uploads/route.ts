import { type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isStorageError } from "@/lib/blob/errors";
import { handleProjectUpload } from "@/lib/media/server";

/**
 * Client-upload token endpoint (`@vercel/blob` client flow).
 *
 * The browser's `upload()` calls this to get a scoped token before sending bytes straight
 * to Blob storage. All authorization lives in the media layer's `handleProjectUpload`
 * (`onBeforeGenerateToken`): we resolve the session here and it verifies the user owns the
 * target project and locks the token to that project's path + allowed types/size.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user.id ?? null;

  try {
    const jsonResponse = await handleProjectUpload({
      body,
      request,
      userId,
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      isStorageError(error) || error instanceof Error
        ? error.message
        : "Upload authorization failed.";
    // 400 is what the Blob client expects for a rejected token request.
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
