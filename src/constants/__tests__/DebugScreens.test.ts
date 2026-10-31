import { DEBUG_SCREEN } from "@/constants/DebugScreens";
import { normalizeRoutePath, readRoutes } from "@/test-helpers/routeTree";

const routes = readRoutes();

const fileFor = (routeName: string) =>
  routes.find((r) => r.file.replace(/^src\/app\//, "").replace(/\.tsx$/, "") === routeName);

describe("DEBUG_SCREEN", () => {
  describe.each(Object.entries(DEBUG_SCREEN))("%s", (_, screen) => {
    it("names a screen that exists", () => {
      expect(fileFor(screen.route)).toBeDefined();
    });

    it("navigates to the screen it names", () => {
      expect(normalizeRoutePath(screen.href)).toBe(fileFor(screen.route)?.routePath);
    });
  });
});
