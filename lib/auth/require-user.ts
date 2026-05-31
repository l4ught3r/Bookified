import { getAuth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function requireUser(request: NextRequest | Request) {
  const { userId } = getAuth(request as NextRequest);

  if (!userId) {
    return {
      userId: null as null,
      unauthorized: NextResponse.json(
        {
          error: "Unauthorized",
          message: "Войдите в аккаунт, чтобы выполнить это действие",
        },
        { status: 401 },
      ),
    };
  }

  return { userId, unauthorized: null as null };
}
