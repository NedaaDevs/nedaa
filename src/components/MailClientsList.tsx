// Hooks and Utils
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Alert } from "react-native";
import { getEmailClients, openComposer } from "react-native-email-link";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { useHaptic } from "@/hooks/useHaptic";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon, MailIcon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { ActionsheetFlatList } from "@/components/ui/actionsheet";

// Icons
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";

type MailClient = {
  androidPackageName: string;
  title: string;
  prefix: string;
  iOSAppName: string;
  id: string;
};

type Props = {
  onClose: () => void;
};

// Mail Clients List Component
const MailClientsList = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const hapticLight = useHaptic("light");
  const [mailClients, setMailClients] = useState<MailClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMailClients();
  }, []);

  const fetchMailClients = async () => {
    try {
      setLoading(true);
      const clients = await getEmailClients();

      // Map the clients to our format with icons
      const formattedClients = clients.map((client) => {
        // Determine icon based on client id
        let icon = "mail";
        const id = client.id.toLowerCase();

        if (id.includes("gmail")) icon = "gmail";
        else if (id.includes("outlook")) icon = "outlook";
        else if (id.includes("yahoo")) icon = "yahoo";

        return {
          ...client,
          icon,
        };
      });

      setMailClients(formattedClients);
    } catch (error) {
      console.error("Error fetching mail clients:", error);
      Alert.alert(t("common.email.clients.error.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleMailClientSelect = async (client: MailClient) => {
    hapticSelection();
    try {
      const appVersion = await Application.nativeApplicationVersion;
      const buildNumber = await Application.nativeBuildVersion;

      // Get device information
      const deviceModel = Device.modelName || "Unknown Device";
      const deviceBrand = Device.brand || "";
      const osName = Device.osName || Platform.OS;
      const osVersion = Device.osVersion || "Unknown Version";

      const systemVersion = `${osName} ${osVersion}`;

      const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

      const subject = t("common.email.template.subject");

      // Build the email body with translations
      const body = `${t("common.email.template.describeRequest")}\n\n\n\n\n${t("common.email.template.appInfo")}\n- ${t("common.email.template.version")}: ${appVersion} (${buildNumber})\n- ${t("common.email.template.device")}: ${deviceBrand} ${deviceModel}\n- ${t("common.email.template.os")}: ${systemVersion}`;

      await openComposer({
        app: client.id,
        to: supportEmail,
        subject: subject,
        body: body,
      });

      // Close the mail clients list
      onClose();
    } catch (error) {
      console.error("Error opening mail client:", error);
      Alert.alert(t("common.email.clients.error.openFailed"));
    }
  };

  const renderClientIcon = (icon: string) => {
    switch (icon) {
      case "mail":
        return <Icon as={MailIcon} size="xl" className="text-accent-primary" />;
      case "gmail":
        return <FontAwesome5 name="google" size={24} color="#DB4437" />;
      case "outlook":
        return <FontAwesome5 name="microsoft" size={24} color="#0078D4" />;
      case "yahoo":
        return <FontAwesome5 name="yahoo" size={24} color="#6001D2" />;
      default:
        return <Icon as={MailIcon} size="xl" className="text-accent-primary" />;
    }
  };

  if (loading) {
    return (
      <Box className="w-full h-60 flex items-center justify-center bg-background-secondary">
        <Text className="text-typography">{t("common.loading")}</Text>
      </Box>
    );
  }

  return (
    <Box className="w-full px-4 py-5 bg-background-secondary rounded-t-2xl">
      <Box className="w-full flex flex-col items-center mb-4">
        <Text className="text-xl font-semibold text-typography">
          {t("common.email.clients.selectClient")}
        </Text>
      </Box>

      {mailClients.length > 0 ? (
        <ActionsheetFlatList
          data={mailClients}
          renderItem={({ item, index }: any) => (
            <Box
              className={`w-full ${
                index < mailClients.length - 1 ? "border-b border-outline" : ""
              }`}>
              <Pressable
                onPress={() => handleMailClientSelect(item)}
                className="py-4 px-3 flex-row justify-between items-center">
                <Box className="flex-row items-center">
                  {renderClientIcon(item.icon)}
                  <Text className="text-lg font-medium text-typography ml-4">{item.title}</Text>
                </Box>
              </Pressable>
            </Box>
          )}
          keyExtractor={(item: any) => item.id}
        />
      ) : (
        <Box className="w-full py-5 flex items-center justify-center">
          <Text className="text-typography">{t("common.email.clients.noClientsFound")}</Text>
        </Box>
      )}

      <Box className="mt-4">
        <Pressable
          onPress={() => {
            hapticLight();
            onClose();
          }}
          className="w-full py-3 flex items-center justify-center bg-background-muted rounded-lg">
          <Text className="text-typography font-medium">{t("common.cancel")}</Text>
        </Pressable>
      </Box>
    </Box>
  );
};

export default MailClientsList;
