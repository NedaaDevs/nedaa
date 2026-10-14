import { act, renderHook } from "@testing-library/react-native";

import { useBusyRequest } from "@/components/onboarding/flow/useBusyRequest";
import { later } from "@/test-helpers/promises";

/** A request the test settles when it chooses. */
const held = () => {
  const request = later();
  return {
    work: jest.fn(() => request.promise),
    release: () => act(async () => request.release()),
  };
};

it("holds the frame busy and reports the request until it settles", async () => {
  const setBusy = jest.fn();
  const request = held();
  const hook = await renderHook(() => useBusyRequest(setBusy));

  await act(async () => hook.result.current.request(request.work));
  expect(setBusy.mock.calls).toEqual([[true]]);
  expect(hook.result.current.requesting).toBe(true);

  await request.release();
  expect(setBusy.mock.calls).toEqual([[true], [false]]);
  expect(hook.result.current.requesting).toBe(false);
});

it("runs one request at a time; a second tap while one runs does nothing", async () => {
  const setBusy = jest.fn();
  const first = held();
  const second = jest.fn(() => Promise.resolve());
  const hook = await renderHook(() => useBusyRequest(setBusy));

  await act(async () => {
    hook.result.current.request(first.work);
    hook.result.current.request(second);
  });
  expect(first.work).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();

  await first.release();
  await act(async () => hook.result.current.request(second));
  expect(second).toHaveBeenCalledTimes(1);
});

// The flow holds busy until it is cleared, so a step gone still clears it.
it("clears busy after the step has left", async () => {
  const setBusy = jest.fn();
  const request = held();
  const hook = await renderHook(() => useBusyRequest(setBusy));

  await act(async () => hook.result.current.request(request.work));
  await hook.unmount();
  await request.release();

  expect(setBusy.mock.calls).toEqual([[true], [false]]);
});
