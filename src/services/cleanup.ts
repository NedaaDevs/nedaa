/**
 * General Cleanup Manager for handling app-wide resource cleanup
 *
 * This service provides a centralized way to register and execute cleanup tasks
 * when the app is backgrounded, terminated, or unmounted.
 */

type CleanupTask = {
  name: string;
  execute: () => void | Promise<void>;
  priority?: number; // Higher priority runs first
};

class CleanupManager {
  private cleanupTasks: CleanupTask[] = [];
  private isExecuting = false;

  /**
   * Register a cleanup task
   * @param name Unique identifier for the cleanup task
   * @param execute Function to execute for cleanup
   * @param priority Optional priority (higher runs first, default: 0)
   */
  register(name: string, execute: () => void | Promise<void>, priority: number = 0): void {
    // Remove existing task with same name to avoid duplicates
    this.unregister(name);

    this.cleanupTasks.push({ name, execute, priority });

    // Sort by priority (higher first)
    this.cleanupTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    console.log(`[CleanupManager] Registered cleanup task: ${name} (priority: ${priority})`);
  }

  /**
   * Unregister a cleanup task
   * @param name Name of the task to remove
   */
  unregister(name: string): void {
    const initialLength = this.cleanupTasks.length;
    this.cleanupTasks = this.cleanupTasks.filter((task) => task.name !== name);

    if (this.cleanupTasks.length < initialLength) {
      console.log(`[CleanupManager] Unregistered cleanup task: ${name}`);
    }
  }

  /**
   * Execute all registered cleanup tasks
   * @param reason Optional reason for cleanup (for logging)
   */
  async executeAll(reason: string = "unknown"): Promise<void> {
    if (this.isExecuting) {
      console.warn("[CleanupManager] Cleanup already in progress, skipping...");
      return;
    }

    this.isExecuting = true;
    console.log(`[CleanupManager] Starting cleanup (reason: ${reason})...`);

    const results: { name: string; success: boolean; error?: Error }[] = [];

    for (const task of this.cleanupTasks) {
      try {
        console.log(`[CleanupManager] Executing cleanup: ${task.name}`);
        await task.execute();
        results.push({ name: task.name, success: true });
        console.log(`[CleanupManager] ✅ Completed cleanup: ${task.name}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({ name: task.name, success: false, error: err });
        console.error(`[CleanupManager] ❌ Failed cleanup: ${task.name}`, err);
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[CleanupManager] Cleanup completed: ${successful} successful, ${failed} failed`);

    this.isExecuting = false;
  }

  /**
   * Get list of registered cleanup tasks (for debugging)
   */
  getRegisteredTasks(): string[] {
    return this.cleanupTasks.map((task) => `${task.name} (priority: ${task.priority || 0})`);
  }

  /**
   * Check if cleanup is currently executing
   */
  isCleanupInProgress(): boolean {
    return this.isExecuting;
  }

  /**
   * Clear all registered cleanup tasks (useful for testing)
   */
  clear(): void {
    this.cleanupTasks = [];
    console.log("[CleanupManager] Cleared all cleanup tasks");
  }
}

export const cleanupManager = new CleanupManager();

export type { CleanupTask };

export { CleanupManager };

export default cleanupManager;
