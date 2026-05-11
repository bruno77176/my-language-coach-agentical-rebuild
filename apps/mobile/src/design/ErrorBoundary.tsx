import { Component, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import {
  palette,
  radius,
  spacing,
  type,
} from "@language-coach/design-tokens";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    });
  }

  reset = () => this.setState({ error: null });

  override render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.body}>
            Restart the app to keep going. We&apos;ve been notified.
          </Text>
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.peach,
    padding: spacing.xl,
  },
  title: { ...type.displayLg, color: palette.ink, textAlign: "center" },
  body: {
    ...type.bodyMd,
    color: palette.inkSoft,
    textAlign: "center",
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: palette.ink,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  buttonText: { ...type.bodyMd, color: palette.peach, fontWeight: "600" },
});
