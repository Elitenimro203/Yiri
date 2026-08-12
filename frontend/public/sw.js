// Service worker minimal : pas de mise en cache offline pour l'instant (ce
// n'est pas l'objectif ici), seulement la réception des notifications push
// et la gestion du clic dessus. Volontairement simple — on ajoutera du cache
// offline plus tard si le besoin se confirme, pas la peine de complexifier
// avant d'en avoir besoin.

self.addEventListener('push', (event) => {
  let data = { title: "Yiri", body: 'Nouveau rappel' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    // payload non-JSON, on garde les valeurs par défaut plutôt que de planter
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // requireInteraction : la notification reste affichée tant que tu ne
      // l'as pas explicitement fermée/cliquée, au lieu de disparaître toute
      // seule après quelques secondes (comportement par défaut du navigateur,
      // trop discret pour un rappel qu'on ne doit pas manquer).
      requireInteraction: true,
      // Motif de vibration — pris en compte sur Android, ignoré sans effet
      // sur iOS/desktop (aucun risque à le laisser).
      vibrate: [200, 100, 200],
      tag: 'yiri-rappel',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si l'app est déjà ouverte dans un onglet, on le met au premier plan
      // plutôt que d'en ouvrir un nouveau — évite d'empiler des onglets à
      // chaque notification cliquée.
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
