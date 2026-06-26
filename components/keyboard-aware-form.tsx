import React from "react";
import { ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

interface Props extends ScrollViewProps {
  children: React.ReactNode;
}

export function KeyboardAwareForm({ children, ...rest }: Props) {
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bottomOffset={24}
      {...rest}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
