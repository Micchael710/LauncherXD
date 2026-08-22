export interface NewsItem {
    id: string;
    title: string;
    summary?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    target_url?: string | null;
    published: boolean;
    published_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface RawNewsItem {
    id: string;
    title: string;
    summary?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    target_url?: string | null;
    published: boolean | 0 | 1;
    published_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateNewsInput {
    title: string;
    summary?: string;
    image_url?: string | null;
    video_url?: string | null;
    target_url?: string;
    published?: boolean;
}

export interface CreateNewsResponse {
    id: string;
    status: 'created';
}

export interface ListNewsResponse {
    value: RawNewsItem[];
    Count: number;
}

export interface UpdateNewsInput {
    title?: string;
    summary?: string;
    image_url?: string | null;
    video_url?: string | null;
    target_url?: string;
    published?: boolean;
}

export interface NewsActionResponse {
    status: 'ok';
}

export function normalizeNewsItem(item: RawNewsItem): NewsItem {
    return {
        ...item,
        published: item.published === true || item.published === 1
    };
}
