import { apiRequest } from './client';

export interface VapidPublicKeyResponse {
  vapid_public_key: string | null;
}

export const getVapidPublicKey = (): Promise<VapidPublicKeyResponse> =>
  apiRequest('/push/vapid-public-key');

interface SubscriptionPayload {
  endpoint: string;
  cle_p256dh: string;
  cle_auth: string;
}

export const subscribePush = (payload: SubscriptionPayload): Promise<unknown> =>
  apiRequest('/push/subscribe', { method: 'POST', body: payload });

export const unsubscribePush = (payload: SubscriptionPayload): Promise<unknown> =>
  apiRequest('/push/subscribe', { method: 'DELETE', body: payload });

/** Convertit la clé VAPID base64url (format serveur) en Uint8Array (format attendu par pushManager.subscribe) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type ActivationResultat = 'active' | 'refuse' | 'non_supporte' | 'erreur';

/**
 * Demande la permission navigateur + crée l'abonnement push + l'enregistre côté serveur.
 * Toute la mécanique en un seul appel — le composant appelant n'a pas à connaître
 * les détails de l'API Push, juste le résultat.
 */
export async function activerNotifications(): Promise<ActivationResultat> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'non_supporte';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return 'refuse';
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const { vapid_public_key } = await getVapidPublicKey();
    if (!vapid_public_key) {
      return 'erreur'; // serveur pas encore configuré (clé VAPID absente)
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid_public_key) as BufferSource,
      });
    }

    const raw = subscription.toJSON();
    await subscribePush({
      endpoint: raw.endpoint!,
      cle_p256dh: raw.keys!.p256dh,
      cle_auth: raw.keys!.auth,
    });

    return 'active';
  } catch (e) {
    console.error('Échec activation notifications', e);
    return 'erreur';
  }
}
