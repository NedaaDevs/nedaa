import {
  ReminderTimeSheetBody,
  type ReminderTimeSheetBodyProps,
} from "@/components/quran/sheets/ReminderTimeSheetBody";

type Props = ReminderTimeSheetBodyProps & { visible: boolean };

// Shows the sheet only while visible. A new time from the caller while it is open
// restarts the body, so the draft follows the caller rather than the last render.
export const ReminderTimeSheet = ({ visible, ...body }: Props) => {
  if (!visible) return null;

  return <ReminderTimeSheetBody key={`${body.hour}:${body.minute}`} {...body} />;
};
