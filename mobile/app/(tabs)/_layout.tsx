import { Tabs } from "expo-router";
import { theme } from "@/components/theme";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.lime,
      tabBarInactiveTintColor: theme.muted,
      tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.line, height: 58, paddingTop: 5, paddingBottom: 4 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      sceneStyle: { backgroundColor: theme.background },
    }}>
      <Tabs.Screen name="index" options={{ title: "Descobrir" }} />
      <Tabs.Screen name="agenda" options={{ title: "Agenda" }} />
      <Tabs.Screen name="library" options={{ title: "Salvos" }} />
      <Tabs.Screen name="privacy" options={{ title: "Privacidade" }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}
