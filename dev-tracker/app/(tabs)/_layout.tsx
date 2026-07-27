import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS, FONTS } from '../../src/lib/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.mono,
        fontSize: 8,
        color: focused ? COLORS.amber : COLORS.creamMuted,
        letterSpacing: 0.5,
        textAlign: 'center',
        marginTop: 2,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.inkDeep,
          borderTopColor: COLORS.inkBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.amber,
        tabBarInactiveTintColor: COLORS.creamMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.mono,
          fontSize: 8,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'CODEX',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? '📖' : '📔'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'ARCHIVES',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? '📜' : '🗒️'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'ANALYSE',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? '⚡' : '📊'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'PARAMÈTRES',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? '⚙️' : '🔧'}</Text>
          ),
        }}
      />
    </Tabs>
  );
}
