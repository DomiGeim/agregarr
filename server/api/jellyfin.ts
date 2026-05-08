import type {
  PlexCollectionItem,
  PlexLibraryItem,
  PlexMetadata,
} from '@server/api/plexapi';
import type { Library, PlexSettings } from '@server/lib/settings';
import logger from '@server/logger';
import axios, { type AxiosInstance } from 'axios';

interface JellyfinSystemInfo {
  Id?: string;
  ServerName?: string;
  Version?: string;
}

interface JellyfinMediaFolder {
  Id: string;
  Name: string;
  CollectionType?: string;
}

interface JellyfinMediaFoldersResponse {
  Items?: JellyfinMediaFolder[];
}

interface JellyfinProviderIds {
  Imdb?: string;
  Tmdb?: string;
  Tvdb?: string;
}

export interface JellyfinLibraryItem {
  Id: string;
  Name: string;
  Type: string;
  ProviderIds?: JellyfinProviderIds;
  ProductionYear?: number;
  DateCreated?: string;
  Overview?: string;
  SortName?: string;
  Tags?: string[];
}

interface JellyfinItemsResponse {
  Items?: JellyfinLibraryItem[];
  TotalRecordCount?: number;
}

export interface JellyfinCollection {
  Id: string;
  Name: string;
  Type: string;
  ProviderIds?: JellyfinProviderIds;
  Overview?: string;
  SortName?: string;
  Tags?: string[];
}

interface PlexCollectionLike {
  ratingKey: string;
  title: string;
  type: string;
  addedAt?: number;
  labels: string[];
  libraryKey?: string;
  libraryName?: string;
  titleSort?: string;
  summary?: string;
  smart?: string;
  Label?: { tag: string; id?: number }[];
  [key: string]: unknown;
}

const normalizeBaseUrl = (settings: PlexSettings): string => {
  const protocol = settings.useSsl ? 'https' : 'http';
  const host = settings.ip.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  return `${protocol}://${host}:${settings.port}`;
};

class JellyfinAPI {
  private client: AxiosInstance;
  private settings: PlexSettings;

  constructor(settings: PlexSettings) {
    this.settings = settings;
    this.client = axios.create({
      baseURL: normalizeBaseUrl(settings),
      timeout: 30000,
      headers: settings.jellyfinApiKey
        ? { 'X-Emby-Token': settings.jellyfinApiKey }
        : undefined,
    });
  }

  private toGuidList(providerIds?: JellyfinProviderIds): { id: string }[] {
    const guids: { id: string }[] = [];

    if (providerIds?.Tmdb) {
      guids.push({ id: `tmdb://${providerIds.Tmdb}` });
    }
    if (providerIds?.Tvdb) {
      guids.push({ id: `tvdb://${providerIds.Tvdb}` });
    }
    if (providerIds?.Imdb) {
      guids.push({ id: `imdb://${providerIds.Imdb}` });
    }

    return guids;
  }

  private toTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
  }

  private toPlexItem(item: JellyfinLibraryItem): PlexLibraryItem {
    const type = item.Type === 'Series' ? 'show' : 'movie';
    const addedAt = this.toTimestamp(item.DateCreated);

    return {
      ratingKey: item.Id,
      title: item.Name,
      guid: item.ProviderIds?.Tmdb
        ? `tmdb://${item.ProviderIds.Tmdb}`
        : item.ProviderIds?.Tvdb
        ? `tvdb://${item.ProviderIds.Tvdb}`
        : item.ProviderIds?.Imdb
        ? `imdb://${item.ProviderIds.Imdb}`
        : item.Id,
      addedAt,
      updatedAt: addedAt,
      year: item.ProductionYear,
      Guid: this.toGuidList(item.ProviderIds),
      type,
      Media: [],
    };
  }

  private toPlexMetadata(item: JellyfinLibraryItem): PlexMetadata {
    const plexItem = this.toPlexItem(item);

    return {
      ...plexItem,
      Guid: plexItem.Guid || [],
      index: 0,
      leafCount: 0,
      viewedLeafCount: 0,
    };
  }

  private toPlexCollection(
    collection: JellyfinCollection,
    library?: Library
  ): PlexCollectionLike {
    const labels = collection.Tags || [];

    return {
      ratingKey: collection.Id,
      key: collection.Id,
      title: collection.Name,
      type: 'collection',
      labels,
      Label: labels.map((tag) => ({ tag })),
      libraryKey: library?.key,
      libraryName: library?.name,
      titleSort: collection.SortName,
      summary: collection.Overview,
    };
  }

  private async getItem(id: string): Promise<JellyfinLibraryItem> {
    const response = await this.client.get<JellyfinLibraryItem>(
      `/Items/${id}`,
      {
        params: {
          Fields:
            'ProviderIds,ProductionYear,DateCreated,Overview,SortName,Tags',
        },
      }
    );

    return response.data;
  }

  public async getStatus(): Promise<{
    MediaContainer: {
      machineIdentifier?: string;
      friendlyName?: string;
      version?: string;
    };
  }> {
    const endpoint = this.settings.jellyfinApiKey
      ? '/System/Info'
      : '/System/Info/Public';
    const response = await this.client.get<JellyfinSystemInfo>(endpoint);

    return {
      MediaContainer: {
        machineIdentifier: response.data.Id,
        friendlyName: response.data.ServerName,
        version: response.data.Version,
      },
    };
  }

  public async getLibraries(): Promise<Library[]> {
    const response = await this.client.get<JellyfinMediaFoldersResponse>(
      '/Library/MediaFolders'
    );

    return (response.data.Items || [])
      .filter(
        (library) =>
          library.CollectionType === 'movies' ||
          library.CollectionType === 'tvshows'
      )
      .map((library) => ({
        key: library.Id,
        name: library.Name,
        type: library.CollectionType === 'tvshows' ? 'show' : 'movie',
      }));
  }

  public async syncLibraries(): Promise<void> {
    const { getSettings } = await import('@server/lib/settings');
    const settings = getSettings();

    try {
      const libraries = await this.getLibraries();
      settings.plex.libraries = libraries.map((library) => {
        const existing = settings.plex.libraries.find(
          (saved) => saved.key === library.key && saved.name === library.name
        );

        return {
          ...library,
          lastScan: existing?.lastScan,
        };
      });
      settings.save();
    } catch (error) {
      logger.error(
        'Failed to sync Jellyfin libraries - keeping existing data',
        {
          label: 'Jellyfin API',
          message: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  }

  public async getLibraryContents(
    id: string,
    { offset = 0, size = 50 }: { offset?: number; size?: number } = {}
  ): Promise<{ totalSize: number; items: PlexLibraryItem[] }> {
    const response = await this.client.get<JellyfinItemsResponse>('/Items', {
      params: {
        ParentId: id,
        Recursive: true,
        IncludeItemTypes: 'Movie,Series',
        Fields: 'ProviderIds,ProductionYear,DateCreated',
        StartIndex: offset,
        Limit: size,
      },
    });

    return {
      totalSize: response.data.TotalRecordCount || 0,
      items: (response.data.Items || []).map((item) => this.toPlexItem(item)),
    };
  }

  public async getCollections(
    parentId?: string
  ): Promise<JellyfinCollection[]> {
    const response = await this.client.get<JellyfinItemsResponse>('/Items', {
      params: {
        ParentId: parentId,
        Recursive: true,
        IncludeItemTypes: 'BoxSet',
        Fields: 'ProviderIds,Overview,SortName,Tags',
      },
    });

    return (response.data.Items || []).map((item) => ({
      Id: item.Id,
      Name: item.Name,
      Type: item.Type,
      ProviderIds: item.ProviderIds,
      Overview: item.Overview,
      SortName: item.SortName,
      Tags: item.Tags,
    }));
  }

  public async createCollection(
    name: string,
    itemIds: string[]
  ): Promise<string | null> {
    const response = await this.client.post<{ Id?: string }>(
      '/Collections',
      undefined,
      {
        params: {
          Name: name,
          Ids: itemIds.join(','),
        },
      }
    );

    return response.data.Id || null;
  }

  public async getMetadata(key: string): Promise<PlexMetadata> {
    const item = await this.getItem(key);

    return this.toPlexMetadata(item);
  }

  public async getRecentlyAdded(
    id: string,
    options: { addedAt: number },
    mediaType: 'movie' | 'show'
  ): Promise<PlexLibraryItem[]> {
    const response = await this.client.get<JellyfinItemsResponse>('/Items', {
      params: {
        ParentId: id,
        Recursive: true,
        IncludeItemTypes: mediaType === 'show' ? 'Series' : 'Movie',
        Fields: 'ProviderIds,ProductionYear,DateCreated',
        SortBy: 'DateCreated',
        SortOrder: 'Descending',
      },
    });

    return (response.data.Items || [])
      .map((item) => this.toPlexItem(item))
      .filter((item) => item.addedAt * 1000 >= options.addedAt);
  }

  public async getAllCollections(): Promise<PlexCollectionLike[]> {
    const libraries = await this.getLibraries();
    const allCollections: PlexCollectionLike[] = [];

    for (const library of libraries) {
      const collections = await this.getCollections(library.key);
      allCollections.push(
        ...collections.map((collection) =>
          this.toPlexCollection(collection, library)
        )
      );
    }

    return allCollections;
  }

  public async getCollectionByName(
    name: string,
    libraryKey: string
  ): Promise<PlexCollectionLike | null> {
    const library = (await this.getLibraries()).find(
      (item) => item.key === libraryKey
    );
    const collections = await this.getCollections(libraryKey);
    const collection = collections.find((item) => item.Name === name);

    return collection ? this.toPlexCollection(collection, library) : null;
  }

  public async getCollectionMetadata(
    ratingKey: string
  ): Promise<PlexCollectionLike> {
    const item = await this.getItem(ratingKey);

    return this.toPlexCollection({
      Id: item.Id,
      Name: item.Name,
      Type: item.Type,
      ProviderIds: item.ProviderIds,
      Overview: item.Overview,
      SortName: item.SortName,
      Tags: item.Tags,
    });
  }

  public async getCollectionMetadataSafe(
    ratingKey: string
  ): Promise<PlexCollectionLike | null> {
    try {
      return await this.getCollectionMetadata(ratingKey);
    } catch (error) {
      logger.warn('Failed to fetch Jellyfin collection metadata', {
        label: 'Jellyfin API',
        ratingKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public async getItemsByRatingKeys(
    ratingKeys: string[]
  ): Promise<PlexCollectionItem[]> {
    if (ratingKeys.length === 0) {
      return [];
    }

    const response = await this.client.get<JellyfinItemsResponse>('/Items', {
      params: {
        Ids: ratingKeys.join(','),
        Fields: 'ProviderIds,ProductionYear,DateCreated',
      },
    });

    const itemsById = new Map(
      (response.data.Items || []).map((item) => [
        item.Id,
        this.toPlexItem(item),
      ])
    );

    return ratingKeys
      .map((ratingKey) => itemsById.get(ratingKey))
      .filter((item): item is PlexLibraryItem => Boolean(item))
      .map((item) => item as unknown as PlexCollectionItem);
  }

  public async createEmptyCollection(title: string): Promise<string | null> {
    return this.createCollection(title, []);
  }

  public async getCollectionItems(
    collectionRatingKey: string
  ): Promise<string[]> {
    const response = await this.client.get<JellyfinItemsResponse>('/Items', {
      params: {
        ParentId: collectionRatingKey,
        Fields: 'ProviderIds,ProductionYear,DateCreated',
      },
    });

    return (response.data.Items || []).map((item) => item.Id);
  }

  public async getCollectionItemsWithMetadata(
    collectionRatingKey: string
  ): Promise<PlexMetadata[]> {
    const response = await this.client.get<JellyfinItemsResponse>('/Items', {
      params: {
        ParentId: collectionRatingKey,
        Fields: 'ProviderIds,ProductionYear,DateCreated',
      },
    });

    return (response.data.Items || []).map((item) => this.toPlexMetadata(item));
  }

  public async addItemsToCollection(
    collectionRatingKey: string,
    items: PlexCollectionItem[]
  ): Promise<void> {
    const itemIds = items.map((item) => item.ratingKey).filter(Boolean);

    if (itemIds.length === 0) {
      return;
    }

    await this.client.post(
      `/Collections/${collectionRatingKey}/Items`,
      undefined,
      {
        params: {
          Ids: itemIds.join(','),
        },
      }
    );
  }

  public async removeSpecificItemsFromCollection(
    collectionRatingKey: string,
    itemsToRemove: string[]
  ): Promise<{ successful: number; failed: number }> {
    if (itemsToRemove.length === 0) {
      return { successful: 0, failed: 0 };
    }

    await this.client.delete(`/Collections/${collectionRatingKey}/Items`, {
      params: {
        Ids: itemsToRemove.join(','),
      },
    });

    return { successful: itemsToRemove.length, failed: 0 };
  }

  public async addSpecificItemsToCollection(
    collectionRatingKey: string,
    itemsToAdd: string[]
  ): Promise<{ successful: number; failed: number }> {
    await this.addItemsToCollection(
      collectionRatingKey,
      itemsToAdd.map((ratingKey) => ({ ratingKey, title: ratingKey }))
    );

    return { successful: itemsToAdd.length, failed: 0 };
  }

  public async updateCollectionContents(
    collectionRatingKey: string,
    desiredItems: PlexCollectionItem[]
  ): Promise<{
    added: number;
    removed: number;
    removedKeys: string[];
    reordered: boolean;
    errors: string[];
  }> {
    const currentItems = await this.getCollectionItems(collectionRatingKey);
    const desiredKeys = desiredItems.map((item) => item.ratingKey);
    const desiredSet = new Set(desiredKeys);
    const currentSet = new Set(currentItems);
    const toRemove = currentItems.filter((item) => !desiredSet.has(item));
    const toAdd = desiredKeys.filter((item) => !currentSet.has(item));

    if (toRemove.length > 0) {
      await this.removeSpecificItemsFromCollection(
        collectionRatingKey,
        toRemove
      );
    }

    if (toAdd.length > 0) {
      await this.addSpecificItemsToCollection(collectionRatingKey, toAdd);
    }

    return {
      added: toAdd.length,
      removed: toRemove.length,
      removedKeys: toRemove,
      reordered: false,
      errors: [],
    };
  }

  public async deleteCollection(collectionRatingKey: string): Promise<void> {
    await this.client.delete(`/Items/${collectionRatingKey}`);
  }

  public async scanLibrary(): Promise<void> {
    await this.client.post('/Library/Refresh');
  }

  public async emptyTrash(): Promise<void> {
    return;
  }

  public async getPlexUserTitle(): Promise<string | null> {
    return null;
  }

  public async addLabelToCollection(): Promise<void> {
    return;
  }

  public async addLabelToItem(): Promise<void> {
    return;
  }

  public async removeLabelFromItem(): Promise<void> {
    return;
  }

  public async getItemsWithLabel(): Promise<PlexCollectionItem[]> {
    return [];
  }

  public async updateCollectionTitle(): Promise<void> {
    return;
  }

  public async updateCollectionSortTitle(): Promise<void> {
    return;
  }

  public async updateCollectionContentSort(): Promise<void> {
    return;
  }

  public async updateCollectionVisibility(): Promise<void> {
    return;
  }

  public async updateSummary(): Promise<void> {
    return;
  }

  public async getCurrentPosterUrl(): Promise<string | null> {
    return null;
  }

  public async getCurrentArtUrl(): Promise<string | null> {
    return null;
  }

  public async getCurrentThemeUrl(): Promise<string | null> {
    return null;
  }

  public async updateCollectionPoster(): Promise<void> {
    return;
  }

  public async updateCollectionArt(): Promise<void> {
    return;
  }

  public async updateCollectionTheme(): Promise<void> {
    return;
  }

  public async createLabelBasedSmartCollection(): Promise<null> {
    logger.warn('Jellyfin does not support Plex smart collections', {
      label: 'Jellyfin API',
    });
    return null;
  }

  public async updateLabelBasedSmartCollectionUri(): Promise<void> {
    logger.warn('Jellyfin does not support Plex smart collections', {
      label: 'Jellyfin API',
    });
  }

  public async arrangeCollectionItemsInOrder(): Promise<void> {
    return;
  }

  public async moveItemInCollection(): Promise<void> {
    return;
  }
}

export default JellyfinAPI;
