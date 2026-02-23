import { Stack } from "expo-router";
import { ClientAuthProvider } from "@/lib/client-auth-context";

export default function ClientLayout() {
  return (
    <ClientAuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ClientAuthProvider>
  );
}
