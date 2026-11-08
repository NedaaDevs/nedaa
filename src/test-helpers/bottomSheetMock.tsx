import {
  createContext,
  Fragment,
  forwardRef,
  use,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type PropsWithChildren,
} from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type AccessibilityRole,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { screen } from "@testing-library/react-native";

/** Test ids for the parts gorhom draws around a sheet's content. */
export const BOTTOM_SHEET_PART = {
  CONTENT: "bottom-sheet-content",
  BACKGROUND: "bottom-sheet-background",
  HANDLE: "bottom-sheet-handle",
  HANDLE_BAR: "bottom-sheet-handle-bar",
  BACKDROP: "bottom-sheet-backdrop",
} as const;

/** gorhom's defaults for an unset prop, as a device shows them. */
const DEFAULT_SHEET_A11Y = {
  accessible: true,
  accessibilityLabel: "Bottom Sheet",
  accessibilityRole: "adjustable",
} as const;
const DEFAULT_HANDLE_A11Y = {
  accessible: true,
  accessibilityLabel: "Bottom sheet handle",
  accessibilityRole: "adjustable",
  accessibilityHint: "Drag up or down to extend or minimize the bottom sheet",
} as const;
const DEFAULT_BACKDROP_A11Y = {
  accessible: true,
  accessibilityLabel: "Bottom sheet backdrop",
  accessibilityRole: "button",
  accessibilityHint: "Tap to close the bottom sheet",
} as const;
const DEFAULT_PRESS_BEHAVIOR = "close";
const DEFAULT_DISAPPEARS_ON_INDEX = 0;

/** The English in every default above. */
export const GORHOM_SPEECH = /bottom sheet/i;

type PressBehavior = "none" | "close" | "collapse" | number;

/** gorhom's nullable props: null drops the default, undefined keeps it. */
const orDefault = <T,>(value: T | null | undefined, fallback: T) =>
  value === undefined ? fallback : (value ?? undefined);

/** An empty backdrop hint makes gorhom speak an English one. */
const backdropHint = (hint: string | null | undefined, pressBehavior: PressBehavior) =>
  orDefault(hint, DEFAULT_BACKDROP_A11Y.accessibilityHint) ||
  `Tap to ${typeof pressBehavior === "string" ? pressBehavior : "move"} the Bottom Sheet`;

type NullableA11y = {
  accessible?: boolean | null;
  accessibilityLabel?: string | null;
  accessibilityHint?: string | null;
  accessibilityRole?: AccessibilityRole | null;
};

type BackdropProps = NullableA11y &
  Pick<ViewProps, "style"> & {
    animatedIndex?: { value: number };
    disappearsOnIndex?: number;
    opacity?: number;
    pressBehavior?: PressBehavior;
  };
type BackgroundProps = Pick<ViewProps, "pointerEvents" | "style">;
type HandleProps = NullableA11y & { indicatorStyle?: ViewProps["style"] };

type ModalProps = PropsWithChildren<
  NullableA11y & {
    onChange?: (index: number) => void;
    onAnimate?: (fromIndex: number, toIndex: number) => void;
    onDismiss?: () => void;
    overrideReduceMotion?: string;
    topInset?: number;
    animationConfigs?: { duration?: number; easing?: unknown; stiffness?: number };
    backgroundStyle?: ViewStyle;
    backgroundComponent?: ComponentType<BackgroundProps> | null;
    handleIndicatorStyle?: ViewStyle;
    handleComponent?: ComponentType<HandleProps> | null;
    enableHandlePanningGesture?: boolean;
    backdropComponent?: ComponentType<BackdropProps>;
    containerComponent?: ComponentType<PropsWithChildren>;
  }
>;

type ModalMethods = { present: () => void; dismiss: (animationConfigs?: object) => void };

/** Present inside a mounted sheet, as gorhom's internal context is. */
const SheetContext = createContext<object | null>(null);
const IN_SHEET = {};

/** Every render's props, newest last. */
export const modalProps = jest.fn<void, [ModalProps]>();

/** The animation each programmatic dismiss asked for, newest last. */
export const dismissConfigs = jest.fn<void, [object | undefined]>();

/** Each presented sheet's close action, top last, as gorhom queues them. */
const presented: (() => void)[] = [];
const closeTop = () => presented.at(-1)?.();

/** gorhom's animated index once a sheet rests on its first detent. */
const SETTLED_INDEX = { value: 0 };

/** gorhom's default background: a "Bottom Sheet" stop no prop turns off. */
const DefaultBackground = ({ pointerEvents, style }: BackgroundProps) => (
  <View
    testID={BOTTOM_SHEET_PART.BACKGROUND}
    pointerEvents={pointerEvents}
    style={style}
    {...DEFAULT_SHEET_A11Y}
  />
);

/** gorhom's default handle: a stop of its own unless its props are null. */
export const BottomSheetHandle = ({ indicatorStyle, ...a11y }: HandleProps) => (
  <View
    testID={BOTTOM_SHEET_PART.HANDLE}
    accessible={orDefault(a11y.accessible, DEFAULT_HANDLE_A11Y.accessible)}
    accessibilityLabel={orDefault(a11y.accessibilityLabel, DEFAULT_HANDLE_A11Y.accessibilityLabel)}
    accessibilityRole={orDefault(a11y.accessibilityRole, DEFAULT_HANDLE_A11Y.accessibilityRole)}
    accessibilityHint={orDefault(a11y.accessibilityHint, DEFAULT_HANDLE_A11Y.accessibilityHint)}>
    <View testID={BOTTOM_SHEET_PART.HANDLE_BAR} style={indicatorStyle} />
  </View>
);

/** gorhom's modal without reanimated: present mounts, dismiss unmounts. */
export const BottomSheetModal = forwardRef<ModalMethods, ModalProps>((props, ref) => {
  modalProps(props);
  const [mounted, setMounted] = useState(false);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  const close = useCallback(() => {
    setMounted(false);
    latest.current.onDismiss?.();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      present: () => setMounted(true),
      dismiss: (animationConfigs?: object) => {
        dismissConfigs(animationConfigs);
        close();
      },
    }),
    [close]
  );

  // Settles at the first detent once up, and queues while it is.
  useEffect(() => {
    if (!mounted) return;
    presented.push(close);
    latest.current.onChange?.(0);
    return () => {
      presented.splice(presented.indexOf(close), 1);
    };
  }, [mounted, close]);

  if (!mounted) return null;
  const Container = props.containerComponent ?? Fragment;
  const Backdrop = props.backdropComponent;
  // An unset part draws gorhom's default; null draws none.
  const Background =
    props.backgroundComponent === undefined ? DefaultBackground : props.backgroundComponent;
  const Handle = props.handleComponent === undefined ? BottomSheetHandle : props.handleComponent;
  return (
    <Container>
      {Backdrop ? <Backdrop animatedIndex={SETTLED_INDEX} style={StyleSheet.absoluteFill} /> : null}
      {Background ? (
        <Background pointerEvents="none" style={[StyleSheet.absoluteFill, props.backgroundStyle]} />
      ) : null}
      <View
        testID={BOTTOM_SHEET_PART.CONTENT}
        accessible={orDefault(props.accessible, DEFAULT_SHEET_A11Y.accessible)}
        accessibilityLabel={orDefault(
          props.accessibilityLabel,
          DEFAULT_SHEET_A11Y.accessibilityLabel
        )}
        accessibilityRole={orDefault(
          props.accessibilityRole,
          DEFAULT_SHEET_A11Y.accessibilityRole
        )}>
        <SheetContext value={IN_SHEET}>{props.children}</SheetContext>
      </View>
      {/* gorhom lays the handle out after the content, so it draws on top. */}
      {Handle ? <Handle indicatorStyle={props.handleIndicatorStyle} /> : null}
    </Container>
  );
});
BottomSheetModal.displayName = "BottomSheetModal";

/** gorhom's backdrop, touchable only above the index it disappears on. */
export const BottomSheetBackdrop = ({
  animatedIndex,
  disappearsOnIndex = DEFAULT_DISAPPEARS_ON_INDEX,
  accessible,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  pressBehavior = DEFAULT_PRESS_BEHAVIOR,
  style,
  opacity,
}: BackdropProps) => {
  // gorhom's own backdrop throws on its first render without animatedIndex.
  if (!animatedIndex) throw new TypeError("BottomSheetBackdrop rendered without animatedIndex");
  return (
    <Pressable
      testID={BOTTOM_SHEET_PART.BACKDROP}
      pointerEvents={animatedIndex.value > disappearsOnIndex ? "auto" : "none"}
      style={[style, { opacity }]}
      // "none" ignores a tap; "collapse" or an index snaps the sheet instead.
      onPress={pressBehavior === "close" ? closeTop : undefined}
      accessible={orDefault(accessible, DEFAULT_BACKDROP_A11Y.accessible)}
      accessibilityLabel={orDefault(accessibilityLabel, DEFAULT_BACKDROP_A11Y.accessibilityLabel)}
      accessibilityHint={backdropHint(accessibilityHint, pressBehavior)}
      accessibilityRole={orDefault(accessibilityRole, DEFAULT_BACKDROP_A11Y.accessibilityRole)}
    />
  );
};

/** gorhom's parts that a screen reader must skip. */
const SILENT_PARTS = [
  BOTTOM_SHEET_PART.CONTENT,
  BOTTOM_SHEET_PART.BACKGROUND,
  BOTTOM_SHEET_PART.HANDLE,
];

const isStop = ({ props }: ReturnType<typeof screen.getByTestId>) =>
  Boolean(
    props.accessible ||
    props.accessibilityLabel ||
    props.accessibilityHint ||
    props.accessibilityRole
  );

/** gorhom's stops: its English, or one of SILENT_PARTS a reader lands on. */
export const gorhomStops = () => {
  const all = { includeHiddenElements: true };
  const stops = new Set([
    ...screen.queryAllByLabelText(GORHOM_SPEECH, all),
    ...screen.queryAllByHintText(GORHOM_SPEECH, all),
    ...SILENT_PARTS.flatMap((part) => screen.queryAllByTestId(part, all)).filter(isStop),
  ]);
  return [...stops].map(({ props }) => ({
    testID: props.testID,
    label: props.accessibilityLabel,
    hint: props.accessibilityHint,
    role: props.accessibilityRole,
  }));
};

export const BottomSheetView = View;
export const BottomSheetScrollView = ScrollView;
export const BottomSheetFlatList = FlatList;
export const BottomSheetTextInput = TextInput;

/** Null outside a sheet when `unsafe`, as gorhom's hook returns. */
export const useBottomSheetInternal = (unsafe?: boolean) => {
  const context = use(SheetContext);
  if (!unsafe && context === null) throw new Error("useBottomSheetInternal outside a sheet");
  return context;
};

/** gorhom builds its timing config from these; the mock hands them back. */
export const useBottomSheetTimingConfigs = <T,>(configs: T) => configs;

export const useBottomSheetModal = () => ({ dismiss: closeTop });
