/** `work`'s value, or `fallback` on failure or after `ms`; never rejects. */
export const withTimeout = <T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
  onTimeout?: () => void
): Promise<T> =>
  new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      // Settled first, so a throwing callback cannot leave the caller waiting.
      resolve(fallback);
      onTimeout?.();
    }, ms);
    const settle = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    work.then(settle, () => settle(fallback));
  });

/** `work`'s result, or a `reason` error after `ms`; `inTime` is then false. */
export const withDeadline = <T>(
  work: (inTime: () => boolean) => Promise<T>,
  ms: number,
  reason: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error(reason));
    }, ms);
  });
  return Promise.race([work(() => !expired), deadline]).finally(() => clearTimeout(timer));
};
