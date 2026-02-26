import { Stack } from "expo-router";
import { AuthProvider } from "@/lib/auth-context";

export default function OnboardingLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="plan-selection" />
        <Stack.Screen name="register" />
      </Stack>
    </AuthProvider>
  );
}
