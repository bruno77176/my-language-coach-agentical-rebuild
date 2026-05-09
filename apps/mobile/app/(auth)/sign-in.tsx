import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import { supabase } from "@/src/lib/supabase";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: "mylanguagecoach://verify" },
    });
    setSending(false);
    if (error) {
      Alert.alert("Couldn't send the link", error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="mb-4 text-2xl font-semibold">Check your email</Text>
        <Text className="text-center text-gray-600">
          We sent a magic link to {email}. Tap it on this device to sign in.
        </Text>
        <TouchableOpacity
          className="mt-8"
          onPress={() => {
            setSent(false);
            setEmail("");
          }}
        >
          <Text className="text-blue-600">Use a different email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-8 text-center text-3xl font-bold">
        My Language Coach
      </Text>
      <Text className="mb-2 text-base font-medium">Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        className="rounded-lg border border-gray-300 p-4 text-base"
      />
      <TouchableOpacity
        onPress={onSubmit}
        disabled={sending || !email.trim()}
        className={`mt-6 rounded-lg p-4 ${
          sending || !email.trim() ? "bg-gray-300" : "bg-blue-600"
        }`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {sending ? "Sending…" : "Send magic link"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
