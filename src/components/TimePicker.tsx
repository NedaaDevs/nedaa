import { TimePickerBody, type TimePickerBodyProps } from "@/components/TimePickerBody";

type Props = TimePickerBodyProps & { isVisible: boolean };

// Shows the picker only while visible. A new time from the caller while it is open
// restarts the body, so the selection follows the caller rather than the last render.
const TimePicker = ({ isVisible, ...body }: Props) => {
  if (!isVisible) return null;

  return <TimePickerBody key={`${body.currentHour}:${body.currentMinute}`} {...body} />;
};

export default TimePicker;
