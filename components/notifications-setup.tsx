import { useNotifications } from "@/lib/use-notifications";

/**
 * Componente auxiliar que inicializa o sistema de notificações.
 * Deve ser montado uma única vez dentro do layout raiz do app.
 * Não renderiza nada visualmente.
 */
export function NotificationsSetup() {
  useNotifications();
  return null;
}
