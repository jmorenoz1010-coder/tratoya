import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { Brand } from '@/constants/brand';

const icons: Record<string, string> = {
  home: '🏠',
  tratos: '🤝',
  pagos: '💰',
  perfil: '👤',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.45 }}>{icons[name]}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Brand.dark,
          borderTopColor: 'rgba(168,196,0,.18)',
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: Brand.limeBright,
        tabBarInactiveTintColor: 'rgba(255,255,255,.4)',
        tabBarLabelStyle: { fontFamily: 'Manrope_700Bold', fontSize: 10.5 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Inicio', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }} />
      <Tabs.Screen name="tratos" options={{ title: 'Mis Tratos', tabBarIcon: ({ focused }) => <TabIcon name="tratos" focused={focused} /> }} />
      <Tabs.Screen name="pagos" options={{ title: 'Pagos', tabBarIcon: ({ focused }) => <TabIcon name="pagos" focused={focused} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon name="perfil" focused={focused} /> }} />
    </Tabs>
  );
}
