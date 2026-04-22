/** Default list fallback: all task tools accept an optional taskListId. */
export function resolveTaskListId(input: string | undefined): string {
  return input && input.length > 0 ? input : '@default';
}
