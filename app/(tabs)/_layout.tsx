import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { PlayerProvider } from '@/contexts/player-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <PlayerProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: insets.bottom + 10,
            height: 62,
            borderTopWidth: 0,
            borderRadius: 22,
            backgroundColor: 'transparent',
            overflow: 'hidden',
          },
          tabBarBackground: () => (
            <View style={styles.tabBarGlass}>
              <BlurView
                intensity={78}
                tint={colorScheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.tabBarBorder,
                  colorScheme === 'dark' ? styles.tabBarBorderDark : styles.tabBarBorderLight,
                ]}
              />
            </View>
          ),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Player',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="music.note" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Files',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="music.note.list" color={color} />,
          }}
        />
      </Tabs>
    </PlayerProvider>
  );
}

const styles = StyleSheet.create({
  tabBarGlass: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  tabBarBorder: {
    borderRadius: 22,
    borderWidth: 1,
  },
  tabBarBorderLight: {
    borderColor: 'rgba(255,255,255,0.88)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabBarBorderDark: {
    borderColor: 'rgba(121,152,160,0.6)',
    backgroundColor: 'rgba(16,28,33,0.28)',
  },
});
