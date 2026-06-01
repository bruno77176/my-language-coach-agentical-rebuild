import { router, Tabs } from "expo-router";
import { TabBar } from "@/src/design";
import { useActiveSession } from "@/src/features/practice/active-session-store";
import { useStaleSessionGuard } from "@/src/features/practice/use-stale-session-guard";

export default function TabsLayout() {
  // Fires on first entry into the tabs area (post-auth, post-onboarding) and
  // on every return-to-foreground while the tabs are mounted.
  useStaleSessionGuard();

  // Intercept tab presses on non-Practice tabs ONLY when the user is leaving
  // the Practice screen mid-conversation. Once they've already left Practice,
  // popups between Progress/Profile/Home would be annoying — they already
  // committed to leaving the conversation on the way out. We scope this via
  // the store's `currentTab` flag (set by useFocusEffect in practice.tsx).
  // getState() reads imperatively at event time — no re-render on store change.
  const makeNonPracticeInterceptor = (tabName: string) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      const s = useActiveSession.getState();
      if (!s.conversationId) return; // no active session — allow nav
      if (s.currentTab !== "practice") return; // already off Practice — allow nav
      e.preventDefault();
      s.requestTabSwitch(tabName);
    },
  });

  // Practice tab interceptor: when the user returns to Practice from another
  // tab AND a live conversation exists, restore the conversation URL. Without
  // this the bare /(tabs)/practice URL renders the chooser and the in-memory
  // conversation disappears from view.
  const onPracticeTabPress = {
    tabPress: (e: { preventDefault: () => void }) => {
      const s = useActiveSession.getState();
      if (!s.activeStartParams) return; // no live session — allow normal nav
      if (s.currentTab === "practice") return; // already on Practice — allow
      e.preventDefault();
      const { scenarioId, start } = s.activeStartParams;
      if (scenarioId) {
        router.replace(`/(tabs)/practice?scenarioId=${scenarioId}`);
      } else if (start) {
        router.replace(`/(tabs)/practice?start=${start}`);
      } else {
        router.replace("/(tabs)/practice");
      }
    },
  };

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home" }}
        listeners={makeNonPracticeInterceptor("home")}
      />
      <Tabs.Screen
        name="practice"
        options={{ title: "Practice" }}
        listeners={onPracticeTabPress}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: "Progress" }}
        listeners={makeNonPracticeInterceptor("progress")}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile" }}
        listeners={makeNonPracticeInterceptor("profile")}
      />
    </Tabs>
  );
}
