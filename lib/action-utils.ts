import { ZodError } from "zod";

export type ActionResult = {
  ok: boolean;
  fieldErrors?: Record<string, string[]>;
  formError?: string;
};

const supabaseMessages: Record<string, string> = {
  "23505": "A record with these details already exists. Please use a unique value and try again.",
  "23503": "This record is linked to other data. Please check your selection and try again.",
  "23502": "A required field is missing. Please complete the form and try again.",
  "22P02": "One of the selected values is invalid. Please refresh and try again.",
  PGRST116: "We could not find the record you tried to update.",
};

function isRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

function isSupabaseError(error: unknown): error is { code?: string; message?: string; details?: string } {
  return typeof error === "object" && error !== null && ("code" in error || "message" in error);
}

export function actionFormData(previousStateOrFormData: ActionResult | FormData | null, formData?: FormData) {
  return formData ?? previousStateOrFormData as FormData;
}

export function actionErrorResult(error: unknown): ActionResult {
  if (isRedirectError(error)) throw error;

  if (error instanceof ZodError) {
    const flattened = error.flatten();
    return {
      ok: false,
      fieldErrors: Object.fromEntries(Object.entries(flattened.fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)),
      formError: flattened.formErrors[0] ?? "Please fix the highlighted fields and try again.",
    };
  }

  if (isSupabaseError(error)) {
    const message = error.code ? supabaseMessages[error.code] : undefined;
    return { ok: false, formError: message ?? error.message ?? "Database request failed. Please try again." };
  }

  return { ok: false, formError: error instanceof Error ? error.message : "Something went wrong. Please try again." };
}

export async function withActionResult(callback: () => Promise<void>): Promise<ActionResult> {
  try {
    await callback();
    return { ok: true };
  } catch (error) {
    return actionErrorResult(error);
  }
}
