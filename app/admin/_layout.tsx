import { Stack } from "expo-router";
import { AuthProvider } from "@/lib/auth-context";
import { AdminDrawerProvider, useAdminDrawer } from "@/lib/admin-drawer-context";
import { AdminDrawer } from "@/components/admin-drawer";
import { View } from "react-native";

function AdminLayoutInner() {
  const { isOpen, closeDrawer } = useAdminDrawer();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <AdminDrawer visible={isOpen} onClose={closeDrawer} />
    </View>
  );
}

export default function AdminLayout() {
  return (
    <AuthProvider>
      <AdminDrawerProvider>
        <AdminLayoutInner />
      </AdminDrawerProvider>
    </AuthProvider>
  );
}
