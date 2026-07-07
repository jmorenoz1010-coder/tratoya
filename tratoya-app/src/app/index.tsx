import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Brand } from '@/constants/brand';
import { useSession } from '@/context/session';

/** Puerta de entrada: decide welcome vs app según la sesión guardada. */
export default function Gate() {
  const { ready, user } = useSession();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.dark }}>
        <ActivityIndicator color={Brand.lime} />
      </View>
    );
  }

  return user ? <Redirect href="/(tabs)/home" /> : <Redirect href="/welcome" />;
}
