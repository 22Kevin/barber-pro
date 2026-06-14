# Como adicionar o HeaderBranchTitle no Dashboard

No seu arquivo `app/admin/(tabs)/dashboard.tsx`, localize onde o header/título
"Dashboard" é renderizado e substitua pelo componente:

```tsx
import { HeaderBranchTitle } from "@/components/BranchSelector";

// Onde você renderiza o título do header, trocar por:
<HeaderBranchTitle />
```

Se o header for via Stack.Screen options (dentro do arquivo de tela):
```tsx
<Stack.Screen options={{ headerTitle: () => <HeaderBranchTitle /> }} />
```

Se for um View customizado no topo da tela (sem Stack header):
```tsx
// No lugar do <Text>Dashboard</Text> ou similar:
<HeaderBranchTitle />
```
