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
  "calendar.badge.plus": "event",
  "person.badge.plus": "person-add",
  "minus.circle.fill": "remove-circle",
  "power": "power-settings-new",
  "photo.on.rectangle": "photo-library",
  "mappin": "location-on",
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
