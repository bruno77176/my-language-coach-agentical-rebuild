import { Tabs } from "expo-router";
import { TabBar } from "@/src/design";
import { useActiveSession } from "@/src/features/practice/active-session-store";
import { useStaleSessionGuard } from "@/src/features/practice/use-stale-session-guard";

export default function TabsLayout() {
  // Fires on first entry into the tabs area (post-auth, post-onboarding) and
  // on every return-to-foreground while the tabs are mounted.
  useStaleSessionGuard();

  // Intercept tab presses on non-Practice tabs when an active conversation
  // exists. The Practice screen watches `pendingTabName` and shows the
  // confirm Alert. We use getState() (not the hook) so a re-render of this
  // layout isn't triggered every time the store changes.
  const makeInterceptor = (tabName: string) => ({
    tabPress: (e: { preventDefault?: () => void; defaultPrevented?: boolean }) => {
      const s = useActiveSession.getState();
      if (!s.conversationId) return; // no active session — let the press go
      e.preventDefault?.();
      s.requestTabSwitch(tabName);
    },
  });

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home" }}
        listeners={makeInterceptor("home")}
      />
      <Tabs.Screen name="practice" options={{ title: "Practice" }} />
      <Tabs.Screen
        name="progress"
        options={{ title: "Progress" }}
        listeners={makeInterceptor("progress")}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile" }}
        listeners={makeInterceptor("profile")}
      />
    </Tabs>
  );
}
