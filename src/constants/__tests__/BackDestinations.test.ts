import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { normalizeRoutePath, readRoutes } from "@/test-helpers/routeTree";

const routes = readRoutes();

/** A navigator names a screen by its file path under src/app. */
const fileFor = (routeName: string) =>
  routes.find((r) => r.file.replace(/^src\/app\//, "").replace(/\.tsx$/, "") === routeName);

describe("BACK_DESTINATION", () => {
  it("finds the route files", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  describe.each(Object.entries(BACK_DESTINATION))("%s", (_, destination) => {
    it("names a screen that exists", () => {
      expect(fileFor(destination.route)).toBeDefined();
    });

    // The route matches the stack, the href drives navigation: both must land on one file.
    it("navigates to the screen it names", () => {
      expect(normalizeRoutePath(destination.href)).toBe(fileFor(destination.route)?.routePath);
    });
  });
});
