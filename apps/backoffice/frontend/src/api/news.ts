import { LocalApiClient } from './client';
import {
    type CreateNewsInput,
    type CreateNewsResponse,
    type ListNewsResponse,
    type NewsItem,
    type UpdateNewsInput,
    type NewsActionResponse,
    normalizeNewsItem
} from '../types/news';

export const NewsApi = {
    async listNews(): Promise<{ value: NewsItem[]; Count: number }> {
        const res = await LocalApiClient.fetch<ListNewsResponse>('/api/admin/news');
        return {
            value: (res.value || []).map(normalizeNewsItem),
            Count: res.Count ?? (res.value?.length || 0)
        };
    },

    async createNews(input: CreateNewsInput): Promise<CreateNewsResponse> {
        const payload: CreateNewsInput = {
            title: input.title
        };
        if (input.summary !== undefined) {
            payload.summary = input.summary;
        }
        if (input.image_url !== undefined) {
            payload.image_url = input.image_url;
        }
        if (input.video_url !== undefined) {
            payload.video_url = input.video_url;
        }
        if (input.target_url !== undefined) {
            payload.target_url = input.target_url;
        }
        if (input.published !== undefined) {
            payload.published = input.published;
        }

        return LocalApiClient.fetch<CreateNewsResponse>('/api/admin/news', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    },

    async updateNews(id: string, input: UpdateNewsInput): Promise<NewsActionResponse> {
        const payload: UpdateNewsInput = {};
        if (input.title !== undefined) {
            payload.title = input.title;
        }
        if (input.summary !== undefined) {
            payload.summary = input.summary;
        }
        if (input.image_url !== undefined) {
            payload.image_url = input.image_url;
        }
        if (input.video_url !== undefined) {
            payload.video_url = input.video_url;
        }
        if (input.target_url !== undefined) {
            payload.target_url = input.target_url;
        }
        if (input.published !== undefined) {
            payload.published = input.published;
        }

        return LocalApiClient.fetch<NewsActionResponse>(`/api/admin/news/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    },

    async deleteNews(id: string): Promise<NewsActionResponse> {
        return LocalApiClient.fetch<NewsActionResponse>(`/api/admin/news/${id}`, {
            method: 'DELETE'
        });
    }
};
