/** An error's message, or the thrown value as text. */
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
