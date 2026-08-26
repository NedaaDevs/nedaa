// The background-refresh task must be defined while the bundle evaluates. A headless
// JobScheduler boot renders no routes, so a defineTask reached only through a route
// module leaves the native task event with no JS handler and the job hangs.
import "expo-router/entry";

import "@/tasks/backgroundRefresh";
