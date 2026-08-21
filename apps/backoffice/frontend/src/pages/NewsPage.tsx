import React, { useState, useEffect, useCallback } from 'react';
import type { NewsItem, CreateNewsInput, UpdateNewsInput } from '../types/news';
import { NewsApi } from '../api/news';
import { formatApiErrorMessage } from '../api/client';
import { NewsTable } from '../components/NewsTable';
import { NewsForm } from '../components/NewsForm';

export const NewsPage: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [tableError, setTableError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
    const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null);

    const fetchNews = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await NewsApi.listNews();
            setNews(res.value || []);
        } catch (err: unknown) {
            setError(formatApiErrorMessage(err, 'news'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    const handleFormSubmit = async (input: CreateNewsInput | UpdateNewsInput) => {
        setIsSubmitting(true);
        setFormError(null);
        try {
            if (editingNews) {
                await NewsApi.updateNews(editingNews.id, input as UpdateNewsInput);
                setEditingNews(null);
            } else {
                await NewsApi.createNews(input as CreateNewsInput);
            }
            await fetchNews();
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err, 'news');
            setFormError(msg);
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (item: NewsItem) => {
        setEditingNews(item);
        setFormError(null);
        setTableError(null);
    };

    const handleCancelEdit = () => {
        setEditingNews(null);
        setFormError(null);
    };

    const handleDelete = async (id: string) => {
        setDeletingNewsId(id);
        setTableError(null);
        try {
            await NewsApi.deleteNews(id);
            if (editingNews && editingNews.id === id) {
                setEditingNews(null);
                setFormError(null);
            }
            await fetchNews();
        } catch (err: unknown) {
            const msg = formatApiErrorMessage(err, 'news');
            setTableError(msg);
        } finally {
            setDeletingNewsId(null);
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>News Management</h1>
                    <p>Create, publish, and edit announcements and articles for the launcher.</p>
                </div>
            </div>

            <NewsTable
                news={news}
                isLoading={isLoading}
                error={tableError || error}
                onEdit={handleEdit}
                onDelete={handleDelete}
                deletingNewsId={deletingNewsId}
            />

            <NewsForm
                onSubmit={handleFormSubmit}
                initialData={editingNews}
                onCancel={handleCancelEdit}
                isSubmitting={isSubmitting}
                errorMessage={formError}
            />
        </div>
    );
};
