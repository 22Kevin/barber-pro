import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  screenName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.screenName ?? "Screen"} crashed:`, error.message);
    console.error("Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={s.container}>
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.title}>Erro ao carregar</Text>
          <Text style={s.msg}>
            {this.props.screenName && `Tela: ${this.props.screenName}\n`}
            {this.state.error?.message ?? "Erro inesperado"}
          </Text>
          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.75 }]}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={s.btnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#0A0A0A",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  icon:  { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", color: "#F0EEE8", marginBottom: 8 },
  msg:   { fontSize: 13, color: "#666", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  btn:   {
    backgroundColor: "#C9A84C", borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  btnText: { fontSize: 14, fontWeight: "700", color: "#0A0A0A" },
});
