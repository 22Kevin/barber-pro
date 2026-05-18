import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Navegação base
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",

  // Admin tabs
  "chart.bar.fill": "bar-chart",
  "calendar": "calendar-today",
  "scissors": "content-cut",
  "bag.fill": "shopping-bag",
  "person.2.fill": "group",
  "dollarsign.circle.fill": "attach-money",
  "star.fill": "star",
  "gearshape.fill": "settings",

  // Ações
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "pencil": "edit",
  "trash": "delete",
  "trash.fill": "delete",
  "xmark": "close",
  "xmark.circle.fill": "cancel",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  "magnifyingglass": "search",
  "arrow.left": "arrow-back",
  "arrow.right": "arrow-forward",
  "arrow.clockwise": "refresh",

  // Conteúdo
  "photo": "photo",
  "photo.fill": "photo",
  "camera.fill": "camera-alt",
  "video.fill": "videocam",
  "clock.fill": "schedule",
  "clock": "access-time",
  "tag.fill": "local-offer",
  "creditcard.fill": "credit-card",
  "banknote.fill": "payments",
  "chart.line.uptrend.xyaxis": "trending-up",
  "chart.pie.fill": "pie-chart",
  "person.fill": "person",
  "phone.fill": "phone",
  "envelope.fill": "email",
  "location.fill": "location-on",
  "bell.fill": "notifications",
  "lock.fill": "lock",
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
  "gift.fill": "card-giftcard",
  "ticket.fill": "confirmation-number",
  "trophy.fill": "emoji-events",
  "arrow.up.arrow.down": "swap-vert",
  "ellipsis": "more-horiz",
  "ellipsis.circle": "more-horiz",
  "info.circle.fill": "info",
  "exclamationmark.triangle.fill": "warning",
  "checkmark.seal.fill": "verified",
  "scissors.badge.ellipsis": "content-cut",
  "cube.box.fill": "inventory",
  "cart.fill": "shopping-cart",
  "whatsapp": "chat",
  "message.fill": "chat",
  "square.and.arrow.up": "share",
  "doc.text.fill": "description",
  "list.bullet": "list",
  "list.bullet.rectangle": "view-agenda",
  "calendar.badge.plus": "event",
  "person.badge.plus": "person-add",
  "minus.circle.fill": "remove-circle",
  "power": "power-settings-new",
  "photo.on.rectangle": "photo-library",
  "mappin": "location-on",

  // Novas funcionalidades
  "bell.badge.fill": "notifications-active",
  "megaphone.fill": "campaign",
  "megaphone": "campaign",
  "person.badge.clock": "person-pin-circle",
  "person.3.fill": "groups",
  "clock.badge.exclamationmark": "schedule",
  "clock.badge.xmark": "event-busy",
  "checkmark.circle": "check-circle-outline",
  "chart.bar": "bar-chart",

  // Estoque e recorrências
  "arrow.down.circle.fill": "arrow-circle-down",
  "arrow.up.circle.fill": "arrow-circle-up",
  "pencil.circle.fill": "edit",
  "clock.arrow.circlepath": "history",
  "calendar.badge.clock": "event-available",

  // Reorganização menu admin v3.6
  "tray.full.fill": "inventory-2",
  "building.2.fill": "store",
  "person.text.rectangle": "badge",
  "chart.bar.doc.horizontal": "receipt-long",
  "paintbrush.fill": "brush",
  "rectangle.portrait.and.arrow.right": "logout",
  "sun.max.fill": "wb-sunny",
  "moon.fill": "dark-mode",
  "person.badge.checkmark": "how-to-reg",
  "person.crop.circle.badge.checkmark": "how-to-reg",
  "person.crop.circle.fill": "account-circle",

  // Intervalo de almoço
  "fork.knife": "restaurant",

  // Paridade v8.1
  "star.bubble.fill": "rate-review",
  "globe": "language",
  "qrcode": "qr-code",
  "link": "link",
  "safari.fill": "open-in-browser",
  "doc.on.clipboard": "content-copy",
  "doc.on.doc": "content-copy",
  "doc.on.doc.fill": "content-copy",
  "square.and.pencil": "edit-note",
  "paintpalette.fill": "palette",
  "antenna.radiowaves.left.and.right": "wifi-tethering",
  "magnifyingglass.circle.fill": "manage-search",
  "location.circle.fill": "my-location",
  "questionmark.circle.fill": "help",
} as unknown as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
