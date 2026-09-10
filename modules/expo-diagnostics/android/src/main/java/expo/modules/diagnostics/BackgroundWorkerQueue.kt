package expo.modules.diagnostics

import androidx.work.WorkInfo

/**
 * The unique work name expo-background-task enqueues its worker under. Upstream keeps the
 * constant private (`BackgroundTaskScheduler.WORKER_IDENTIFIER`), so the literal is repeated
 * here and WorkManager matches unique names by exact string. A rename upstream therefore
 * surfaces as `total` falling to zero rather than as a build failure — read a zero total as
 * "nothing matched this name", never as "the queue is empty".
 */
const val BACKGROUND_WORKER_UNIQUE_NAME = "EXPO_BACKGROUND_WORKER"

/**
 * Groups the entries filed under the background-task unique name by work state.
 *
 * The split is the point. Work appended behind a running head waits in BLOCKED and runs in
 * order, whereas several ENQUEUED or RUNNING roots execute at once; only the second shape
 * races the per-uid alarm ceiling, and the two call for different repairs. A single total
 * cannot tell them apart, so every state is reported separately.
 *
 * WorkManager keeps finished entries for about a day before pruning them, so the finished
 * counts describe a recent window rather than a lifetime, and `unfinished` is the live depth.
 */
fun summarizeBackgroundWorkerQueue(workInfos: List<WorkInfo>): Map<String, Any> {
  val byState = workInfos.groupingBy { it.state }.eachCount()
  return mapOf(
    "uniqueName" to BACKGROUND_WORKER_UNIQUE_NAME,
    "total" to workInfos.size,
    "unfinished" to workInfos.count { !it.state.isFinished },
    "enqueued" to (byState[WorkInfo.State.ENQUEUED] ?: 0),
    "running" to (byState[WorkInfo.State.RUNNING] ?: 0),
    "blocked" to (byState[WorkInfo.State.BLOCKED] ?: 0),
    "succeeded" to (byState[WorkInfo.State.SUCCEEDED] ?: 0),
    "failed" to (byState[WorkInfo.State.FAILED] ?: 0),
    "cancelled" to (byState[WorkInfo.State.CANCELLED] ?: 0),
    "maxRunAttemptCount" to (workInfos.maxOfOrNull { it.runAttemptCount } ?: 0),
  )
}
