export type Props = {
  /**
   * Current network status
   */
  status: "online" | "offline" | "slow" | "error";

  /**
   * Show retry button
   */
  showRetry?: boolean;

  /**
   * Retry action callback
   */
  onRetry?: () => void;

  /**
   * Custom message to display
   */
  message?: string;

  /**
   * Show countdown timer for auto-retry
   */
  retryCountdown?: number;

  /**
   * Whether the banner can be dismissed
   */
  dismissible?: boolean;

  /**
   * Dismiss callback
   */
  onDismiss?: () => void;

  /**
   * Custom class name
   */
  className?: string;
};
