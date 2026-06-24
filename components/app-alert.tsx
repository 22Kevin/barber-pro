import React, { createContext, useContext, useState, useCallback } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AppAlertContextType {
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const AppAlertContext = createContext<AppAlertContextType>({
  show: () => {},
});

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: "",
    message: undefined,
    buttons: [],
  });

  const show = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    setState({
      visible: true,
      title,
      message,
      buttons: buttons ?? [{ text: "OK" }],
    });
  }, []);

  const dismiss = (btn?: AlertButton) => {
    setState((prev) => ({ ...prev, visible: false }));
    if (btn?.onPress) setTimeout(btn.onPress, 150);
  };

  return (
    <AppAlertContext.Provider value={{ show }}>
      {children}
      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => dismiss()}
      >
        <View style={s.overlay}>
          <View style={s.card}>
            {/* Gold top accent */}
            <View style={s.topAccent} />

            <View style={s.body}>
              <Text style={s.title}>{state.title}</Text>
              {state.message ? (
                <Text style={s.message}>{state.message}</Text>
              ) : null}
            </View>

            <View style={s.divider} />

            <View style={[s.btnRow, state.buttons.length === 1 && { justifyContent: "center" }]}>
              {state.buttons.map((btn, i) => {
                const isDestructive = btn.style === "destructive";
                const isCancel = btn.style === "cancel";
                const isLast = i === state.buttons.length - 1;
                return (
                  <React.Fragment key={i}>
                    <Pressable
                      style={({ pressed }) => [
                        s.btn,
                        pressed && { opacity: 0.7 },
                        isLast && !isCancel && s.btnPrimary,
                      ]}
                      onPress={() => dismiss(btn)}
                    >
                      <Text
                        style={[
                          s.btnText,
                          isDestructive && { color: "#EF4444" },
                          isCancel && { color: "#888" },
                          isLast && !isCancel && !isDestructive && s.btnTextPrimary,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </Pressable>
                    {i < state.buttons.length - 1 && <View style={s.btnDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert() {
  return useContext(AppAlertContext);
}

// Drop-in replacement for Alert.alert
export const AppAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    // This will be set by the provider
    _globalShow(title, message, buttons);
  },
};

let _globalShow: (title: string, message?: string, buttons?: AlertButton[]) => void = () => {};

export function AppAlertProviderWithGlobal({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({
    visible: false,
    title: "",
    message: undefined,
    buttons: [],
  });

  const show = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    setState({
      visible: true,
      title,
      message,
      buttons: buttons ?? [{ text: "OK" }],
    });
  }, []);

  React.useEffect(() => {
    _globalShow = show;
  }, [show]);

  const dismiss = (btn?: AlertButton) => {
    setState((prev) => ({ ...prev, visible: false }));
    if (btn?.onPress) setTimeout(btn.onPress, 150);
  };

  return (
    <AppAlertContext.Provider value={{ show }}>
      {children}
      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => dismiss()}
      >
        <View style={s.overlay}>
          <View style={s.card}>
            <View style={s.topAccent} />
            <View style={s.body}>
              <Text style={s.title}>{state.title}</Text>
              {state.message ? (
                <Text style={s.message}>{state.message}</Text>
              ) : null}
            </View>
            <View style={s.divider} />
            <View style={[s.btnRow, state.buttons.length === 1 && { justifyContent: "center" }]}>
              {state.buttons.map((btn, i) => {
                const isDestructive = btn.style === "destructive";
                const isCancel = btn.style === "cancel";
                const isLast = i === state.buttons.length - 1;
                return (
                  <React.Fragment key={i}>
                    <Pressable
                      style={({ pressed }) => [
                        s.btn,
                        pressed && { opacity: 0.7 },
                        isLast && !isCancel && s.btnPrimary,
                      ]}
                      onPress={() => dismiss(btn)}
                    >
                      <Text
                        style={[
                          s.btnText,
                          isDestructive && { color: "#EF4444" },
                          isCancel && { color: "#666" },
                          isLast && !isCancel && !isDestructive && s.btnTextPrimary,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </Pressable>
                    {i < state.buttons.length - 1 && <View style={s.btnDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
  },
  topAccent: {
    height: 3,
    backgroundColor: "#C9A84C",
    width: "100%",
  },
  body: {
    padding: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#A0A0A0",
    lineHeight: 20,
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A2A",
  },
  btnRow: {
    flexDirection: "row",
    minHeight: 48,
  },
  btnDivider: {
    width: 1,
    backgroundColor: "#2A2A2A",
  },
  btn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  btnPrimary: {
    backgroundColor: "#1A1500",
  },
  btnText: {
    fontSize: 15,
    color: "#888888",
    fontWeight: "500",
  },
  btnTextPrimary: {
    color: "#C9A84C",
    fontWeight: "700",
  },
});
