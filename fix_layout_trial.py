import re

path = "app/_layout.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Mudança 1: adicionar import do router se não existir
if 'router as expoRouter' not in content:
    content = content.replace(
        'import { KeyboardProvider } from "react-native-keyboard-controller";',
        'import { KeyboardProvider } from "react-native-keyboard-controller";\nimport { router as expoRouter } from "expo-router";'
    )
    print("✓ Import do expoRouter adicionado")
else:
    print("✓ Import do expoRouter já existe")

# Mudança 2: substituir retry simples pela função que ignora FORBIDDEN
old_retry = '''queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },'''

new_retry = '''queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Não repetir requisições que falharam com FORBIDDEN (trial expirado)
            retry: (failureCount, error: any) => {
              const code = error?.data?.code ?? error?.shape?.data?.code;
              if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return false;
              return failureCount < 1;
            },
          },
          mutations: {
            retry: (failureCount, error: any) => {
              const code = error?.data?.code ?? error?.shape?.data?.code;
              if (code === "FORBIDDEN" || code === "UNAUTHORIZED") return false;
              return failureCount < 1;
            },
          },'''

if 'retry: 1,' in content:
    content = content.replace(old_retry, new_retry)
    print("✓ QueryClient retry atualizado")
elif 'FORBIDDEN' in content:
    print("✓ QueryClient retry já está atualizado")
else:
    print("⚠ Bloco não encontrado — verifique manualmente")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Concluído.")
