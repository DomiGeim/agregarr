import JellyfinAPI from '@server/api/jellyfin';
import type { PlexSettings } from '@server/lib/settings';

class EmbyAPI extends JellyfinAPI {
  constructor(settings: PlexSettings) {
    super(settings, {
      profileType: 'emby',
      displayName: 'Emby',
    });
  }
}

export default EmbyAPI;
