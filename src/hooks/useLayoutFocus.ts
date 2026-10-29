import { useState } from "react";

import { layoutFocus } from "@/utils/layoutFocus";

/** A layout-armed reader focus for one view, kept for the component's life. */
export const useLayoutFocus = () => useState(layoutFocus)[0];
