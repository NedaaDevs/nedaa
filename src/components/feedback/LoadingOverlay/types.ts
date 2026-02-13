export type Props = {
  /**
   * Whether the overlay is visible
   */
  visible: boolean;

  /**
   * Loading message to display
   */
  message?: string;

  /**
   * Progress percentage (0-100)
   */
  progress?: number;

  /**
   * Whether the loading can be cancelled
   */
  cancellable?: boolean;

  /**
   * Cancel callback
   */
  onCancel?: () => void;

  /**
   * Estimated time remaining in seconds
   */
  estimatedTime?: number;
};
