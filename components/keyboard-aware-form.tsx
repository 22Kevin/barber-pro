/**
 * KeyboardAwareForm
 * Wrapper confiável para formulários que precisam evitar o teclado no Android.
 * Usa useWindowDimensions + keyboard events para calcular o offset correto,
 * funcionando mesmo com edgeToEdgeEnabled: true.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardEvent,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from "react-native";

interface Props extends ScrollViewProps {
  children: React.ReactNode;
  extraScrollHeight?: number;
}

export function KeyboardAwareForm({
  children,
  extraScrollHeight = 24,
  style,
  contentContainerStyle,
  ...rest
}: Props) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, style]}
      contentContainerStyle={[
        { paddingBottom: keyboardHeight + extraScrollHeight },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
