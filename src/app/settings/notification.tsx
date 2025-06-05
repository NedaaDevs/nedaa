// Components
import { Box } from "@/components/ui/box";
import TopBar from "@/components/TopBar";

const NotificationSettings = () => {
  return (
    <Box className="flex-1 bg-grey dark:bg-slate-900">
      <TopBar title="settings.notification.title" href="/" backOnClick />
    </Box>
  );
};

export default NotificationSettings;
