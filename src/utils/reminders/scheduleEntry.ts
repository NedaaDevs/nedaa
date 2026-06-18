// Re-runs the full notification schedule so reminder changes take effect. The
// body is wired to the app's scheduler in the notification-scheduler task; kept
// behind this seam so the store stays unit-testable.
export const scheduleFromCurrentState = async (): Promise<void> => {};
