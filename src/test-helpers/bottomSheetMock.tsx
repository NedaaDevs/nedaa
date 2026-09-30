import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type PropsWithChildren,
} from "react";
import {
  Pressable,
  ScrollView,
  View,
  type AccessibilityRole,
  type ViewProps,
  type ViewStyle,
} from "react-native";

/** Test ids for the parts gorhom draws around a sheet's content. */
export const BOTTOM_SHEET_PART = {
  CONTENT: "bottom-sheet-content",
  BACKDROP: "bottom-sheet-backdrop",
} as const;

/** gorhom's defaults for an unset prop, as a device shows them. */
const DEFAULT_CONTENT_A11Y = {
  accessible: true,
  accessibilityLabel: "Bottom Sheet",
  accessibilityRole: "adjustable",
} as const;
const DEFAULT_BACKDROP_A11Y = {
  accessible: true,
  accessibilityLabel: "Bottom sheet backdrop",
  accessibilityRole: "button",
} as const;

/** gorhom's nullable props: null drops the default, undefined keeps it. */
const orDefault = <T,>(value: T | null | undefined, fallback: T) =>
  value === undefined ? fallback : (value ?? undefined);

type NullableA11y = {
  accessible?: boolean | null;
  accessibilityLabel?: string | null;
  accessibilityRole?: AccessibilityRole | null;
};

type BackdropProps = NullableA11y & Pick<ViewProps, "style">;

type ModalProps = PropsWithChildren<
  NullableA11y & {
    onChange?: (index: number) => void;
    onDismiss?: () => void;
    overrideReduceMotion?: string;
    topInset?: number;
    animationConfigs?: { duration?: number; easing?: unknown };
    backgroundStyle?: ViewStyle;
    handleIndicatorStyle?: ViewStyle;
    backdropComponent?: ComponentType<BackdropProps>;
    containerComponent?: ComponentType<PropsWithChildren>;
  }
>;

type ModalMethods = { present: () => void; dismiss: () => void };

/** Every render's props, newest last. */
export const modalProps = jest.fn<void, [ModalProps]>();

/** Each presented sheet's close action, top last, as gorhom queues them. */
const presented: (() => void)[] = [];

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

  useImperativeHandle(ref, () => ({ present: () => setMounted(true), dismiss: close }), [close]);

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
  return (
    <Container>
      {Backdrop ? <Backdrop /> : null}
      <View
        testID={BOTTOM_SHEET_PART.CONTENT}
        accessible={orDefault(props.accessible, DEFAULT_CONTENT_A11Y.accessible)}
        accessibilityLabel={orDefault(
          props.accessibilityLabel,
          DEFAULT_CONTENT_A11Y.accessibilityLabel
        )}
        accessibilityRole={orDefault(
          props.accessibilityRole,
          DEFAULT_CONTENT_A11Y.accessibilityRole
        )}>
        {props.children}
      </View>
    </Container>
  );
});
BottomSheetModal.displayName = "BottomSheetModal";

/** Closes the top sheet, as a tap on gorhom's backdrop does. */
export const BottomSheetBackdrop = ({
  accessible,
  accessibilityLabel,
  accessibilityRole,
  style,
}: BackdropProps) => (
  <Pressable
    testID={BOTTOM_SHEET_PART.BACKDROP}
    style={style}
    onPress={() => presented.at(-1)?.()}
    accessible={orDefault(accessible, DEFAULT_BACKDROP_A11Y.accessible)}
    accessibilityLabel={orDefault(accessibilityLabel, DEFAULT_BACKDROP_A11Y.accessibilityLabel)}
    accessibilityRole={orDefault(accessibilityRole, DEFAULT_BACKDROP_A11Y.accessibilityRole)}
  />
);

export const BottomSheetScrollView = ScrollView;

/** gorhom builds its timing config from these; the mock hands them back. */
export const useBottomSheetTimingConfigs = <T,>(configs: T) => configs;

export const useBottomSheetModal = () => ({
  dismiss: () => presented.at(-1)?.(),
});
