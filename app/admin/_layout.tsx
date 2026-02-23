import { Stack } from "expo-router";
import { AuthProvider } from "@/lib/auth-context";

export default function AdminLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
