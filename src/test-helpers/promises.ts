/** A promise that never settles: a call still waiting for its answer. */
export const never = <T = void>() => new Promise<T>(() => {});

/** A promise the test settles, or fails, when it chooses. */
export const later = <T = void>() => {
  let release: (value: T) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  return { promise, release, fail };
};

/** Lets pending promise steps run until `done` holds. */
export const until = async (done: () => boolean) => {
  for (let step = 0; step < 50 && !done(); step += 1) await Promise.resolve();
};

/** The promise's outcome as a mock call, with no rejection left unhandled. */
export const outcomeOf = (promise: Promise<unknown>) => {
  const outcome = jest.fn();
  promise.then(
    (value) => outcome({ value }),
    (error: unknown) => outcome({ error })
  );
  return outcome;
};
