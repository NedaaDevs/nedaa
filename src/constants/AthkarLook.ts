/** The looks the Athkar reader can wear. */
export const ATHKAR_LOOK = { CLASSIC: "classic", HORIZON: "horizon" } as const;

export type AthkarLookId = (typeof ATHKAR_LOOK)[keyof typeof ATHKAR_LOOK];

/** Every look, in the order a person is offered them. */
export const ATHKAR_LOOK_IDS: readonly AthkarLookId[] = Object.values(ATHKAR_LOOK);

/** The look drawn until a person chooses one. */
export const DEFAULT_ATHKAR_LOOK: AthkarLookId = ATHKAR_LOOK.CLASSIC;

export const isAthkarLookId = (value: unknown): value is AthkarLookId =>
  ATHKAR_LOOK_IDS.some((id) => id === value);
