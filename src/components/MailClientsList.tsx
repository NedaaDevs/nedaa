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

const MailClientsList = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const hapticLight = useHaptic("light");
  const [mailClients, setMailClients] = useState<MailClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMailClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMailClients = async () => {
    try {
      setLoading(true);
      const clients = await getEmailClients();

      const formattedClients = clients.map((client) => {
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
      Alert.alert(t("email.clients.error.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleMailClientSelect = async (client: MailClient) => {
    hapticSelection();
    try {
      const appVersion = await Application.nativeApplicationVersion;
      const buildNumber = await Application.nativeBuildVersion;

      const deviceModel = Device.modelName || "Unknown Device";
      const deviceBrand = Device.brand || "";
      const osName = Device.osName || Platform.OS;
      const osVersion = Device.osVersion || "Unknown Version";

      const systemVersion = `${osName} ${osVersion}`;

      const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

      const subject = t("email.template.subject");

      const body = `${t("email.template.describeRequest")}\n\n\n\n\n${t("email.template.appInfo")}\n- ${t("email.template.version")}: ${appVersion} (${buildNumber})\n- ${t("email.template.device")}: ${deviceBrand} ${deviceModel}\n- ${t("email.template.os")}: ${systemVersion}`;

      await openComposer({
        app: client.id,
        to: supportEmail,
        subject: subject,
        body: body,
      });

      onClose();
    } catch (error) {
      console.error("Error opening mail client:", error);
      Alert.alert(t("email.clients.error.openFailed"));
    }
  };

  const renderClientIcon = (icon: string) => {
    switch (icon) {
      case "mail":
        return <Icon as={MailIcon} size="xl" color="$accentPrimary" />;
      case "gmail":
        return <FontAwesome5 name="google" size={24} color="#DB4437" />;
      case "outlook":
        return <FontAwesome5 name="microsoft" size={24} color="#0078D4" />;
      case "yahoo":
        return <FontAwesome5 name="yahoo" size={24} color="#6001D2" />;
      default:
        return <Icon as={MailIcon} size="xl" color="$accentPrimary" />;
    }
  };

  if (loading) {
    return (
      <Box
        width="100%"
        height={240}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$backgroundSecondary">
        <Text color="$typography">{t("loading")}</Text>
      </Box>
    );
  }

  return (
    <Box
      width="100%"
      paddingHorizontal="$4"
      paddingVertical="$5"
      backgroundColor="$backgroundSecondary"
      borderTopLeftRadius="$7"
      borderTopRightRadius="$7">
      <Box width="100%" flexDirection="column" alignItems="center" marginBottom="$4">
        <Text size="xl" fontWeight="600" color="$typography">
          {t("email.clients.selectClient")}
        </Text>
      </Box>

      {mailClients.length > 0 ? (
        <ActionsheetFlatList
          data={mailClients}
          renderItem={({ item, index }: any) => (
            <Box
              width="100%"
              borderBottomWidth={index < mailClients.length - 1 ? 1 : 0}
              borderColor={index < mailClients.length - 1 ? "$outline" : undefined}>
              <Pressable
                onPress={() => handleMailClientSelect(item)}
                paddingVertical="$4"
                paddingHorizontal="$3"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center">
                <Box flexDirection="row" alignItems="center">
                  {renderClientIcon(item.icon)}
                  <Text size="lg" fontWeight="500" color="$typography" marginStart="$4">
                    {item.title}
                  </Text>
                </Box>
              </Pressable>
            </Box>
          )}
          keyExtractor={(item: any) => item.id}
        />
      ) : (
        <Box width="100%" paddingVertical="$5" alignItems="center" justifyContent="center">
          <Text color="$typography">{t("email.clients.noClientsFound")}</Text>
        </Box>
      )}

      <Box marginTop="$4">
        <Pressable
          onPress={() => {
            hapticLight();
            onClose();
          }}
          width="100%"
          paddingVertical="$3"
          minHeight={44}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$backgroundMuted"
          borderRadius="$4"
          accessibilityRole="button">
          <Text color="$typography" fontWeight="500">
            {t("cancel")}
          </Text>
        </Pressable>
      </Box>
    </Box>
  );
};

export default MailClientsList;
