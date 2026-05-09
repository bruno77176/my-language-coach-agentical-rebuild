import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || password.length < 6) return;
    setBusy(true);

    // Try sign in first; if user doesn't exist, fall through to sign up.
    const signInResult = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (!signInResult.error) {
      // eslint-disable-next-line no-console
      console.log("[SIGN-IN] signInWithPassword OK");
      setBusy(false);
      router.replace("/");
      return;
    }
    // eslint-disable-next-line no-console
    console.log(
      "[SIGN-IN] signInWithPassword failed:",
      signInResult.error.message,
    );

    // "Invalid login credentials" can mean wrong password OR no such user.
    // Try sign up; if THAT errors with "already registered", the password
    // was wrong on the first call.
    const signUpResult = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    setBusy(false);

    if (signUpResult.error) {
      const msg = signUpResult.error.message;
      // eslint-disable-next-line no-console
      console.log("[SIGN-IN] signUp failed:", msg);
      if (/already|registered|exists/i.test(msg)) {
        Alert.alert(
          "Wrong password",
          "This email is registered but the password didn't match.",
        );
      } else {
        Alert.alert("Sign-in failed", msg);
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      "[SIGN-IN] signUp OK — has session:",
      !!signUpResult.data.session,
    );

    // Sign-up succeeded. Some Supabase configs auto-confirm + return a session
    // immediately; if the session is null, the user needs to confirm email.
    if (!signUpResult.data.session) {
      Alert.alert(
        "Email confirmation required",
        "Account created but Supabase needs you to confirm the email first. Either check your inbox for a confirmation link, or in Supabase dashboard → Authentication → Providers → Email, turn off 'Confirm email'.",
      );
      return;
    }
    // Successful new account with session → navigate.
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titleHero}>My Language Coach</Text>
      <Text style={styles.subtitle}>Sign in or create your account.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        style={styles.input}
      />

      <Text style={[styles.label, styles.labelSpacing]}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        style={styles.input}
      />

      <TouchableOpacity
        onPress={submit}
        disabled={busy || !email.trim() || password.length < 6}
        style={[
          styles.button,
          (busy || !email.trim() || password.length < 6) &&
            styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {busy ? "Signing in…" : "Sign in / Sign up"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        First time? Pick any password you'll remember; we'll create your
        account.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
  },
  titleHero: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    color: "#374151",
  },
  labelSpacing: {
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  button: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
  },
  buttonDisabled: {
    backgroundColor: "#d1d5db",
  },
  buttonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
});
