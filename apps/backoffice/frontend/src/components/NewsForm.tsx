import React, { useState, useEffect } from 'react';
import type { CreateNewsInput, UpdateNewsInput, NewsItem } from '../types/news';

export interface NewsFormProps {
    onSubmit: (input: CreateNewsInput | UpdateNewsInput) => Promise<void>;
    initialData?: NewsItem | null;
    onCancel?: () => void;
    isSubmitting?: boolean;
    errorMessage?: string | null;
}

function isValidHttpUrl(urlString: string): boolean {
    try {
        const parsed = new URL(urlString);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidVideoUrl(urlString: string): boolean {
    try {
        const parsed = new URL(urlString);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const pathname = parsed.pathname.toLowerCase();
        return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
    } catch {
        return false;
    }
}

export type MediaType = 'none' | 'image' | 'video';

export const NewsForm: React.FC<NewsFormProps> = ({
    onSubmit,
    initialData = null,
    onCancel,
    isSubmitting = false,
    errorMessage = null
}) => {
    const isEdit = Boolean(initialData);

    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [mediaType, setMediaType] = useState<MediaType>('none');
    const [imageUrl, setImageUrl] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [published, setPublished] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title || '');
            setSummary(initialData.summary || '');
            if (initialData.video_url) {
                setMediaType('video');
                setVideoUrl(initialData.video_url);
                setImageUrl('');
            } else if (initialData.image_url) {
                setMediaType('image');
                setImageUrl(initialData.image_url);
                setVideoUrl('');
            } else {
                setMediaType('none');
                setImageUrl('');
                setVideoUrl('');
            }
            setTargetUrl(initialData.target_url || '');
            setPublished(Boolean(initialData.published));
            setLocalError(null);
        } else {
            setTitle('');
            setSummary('');
            setMediaType('none');
            setImageUrl('');
            setVideoUrl('');
            setTargetUrl('');
            setPublished(false);
            setLocalError(null);
        }
    }, [initialData]);

    const handleMediaTypeChange = (newType: MediaType) => {
        setMediaType(newType);
        if (newType === 'none') {
            setImageUrl('');
            setVideoUrl('');
        } else if (newType === 'image') {
            setVideoUrl('');
        } else if (newType === 'video') {
            setImageUrl('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setLocalError('Title is required.');
            return;
        }
        if (trimmedTitle.length > 200) {
            setLocalError('Title cannot exceed 200 characters.');
            return;
        }

        const trimmedSummary = summary.trim();
        if (trimmedSummary.length > 1000) {
            setLocalError('Summary cannot exceed 1000 characters.');
            return;
        }

        const trimmedImageUrl = mediaType === 'image' ? imageUrl.trim() : '';
        const trimmedVideoUrl = mediaType === 'video' ? videoUrl.trim() : '';

        if (mediaType === 'image' && trimmedImageUrl) {
            if (!isValidHttpUrl(trimmedImageUrl)) {
                setLocalError('Image URL must be a valid absolute URL starting with http:// or https://.');
                return;
            }
        }

        if (mediaType === 'video' && trimmedVideoUrl) {
            if (!isValidVideoUrl(trimmedVideoUrl)) {
                setLocalError('Video URL must be a valid absolute URL starting with http:// or https:// and ending in .mp4 or .webm.');
                return;
            }
        }

        const trimmedTargetUrl = targetUrl.trim();
        if (trimmedTargetUrl) {
            if (!isValidHttpUrl(trimmedTargetUrl)) {
                setLocalError('Target URL must be a valid absolute URL starting with http:// or https://.');
                return;
            }
        }

        if (isEdit && initialData) {
            const partialPayload: UpdateNewsInput = {};

            if (trimmedTitle !== initialData.title) {
                partialPayload.title = trimmedTitle;
            }

            const initialSummary = initialData.summary || '';
            if (trimmedSummary !== initialSummary) {
                partialPayload.summary = trimmedSummary; // Can be '' to clear
            }

            const initialImageUrl = initialData.image_url || '';
            if (trimmedImageUrl !== initialImageUrl) {
                partialPayload.image_url = trimmedImageUrl; // Can be '' to clear
            }

            const initialVideoUrl = initialData.video_url || '';
            if (trimmedVideoUrl !== initialVideoUrl) {
                partialPayload.video_url = trimmedVideoUrl; // Can be '' to clear
            }

            const initialTargetUrl = initialData.target_url || '';
            if (trimmedTargetUrl !== initialTargetUrl) {
                partialPayload.target_url = trimmedTargetUrl; // Can be '' to clear
            }

            if (published !== initialData.published) {
                partialPayload.published = published;
            }

            if (Object.keys(partialPayload).length === 0) {
                onCancel?.();
                return;
            }

            try {
                await onSubmit(partialPayload);
            } catch {
                // Parent handles error display
            }
            return;
        }

        const input: CreateNewsInput = {
            title: trimmedTitle,
            summary: trimmedSummary || undefined,
            image_url: trimmedImageUrl || undefined,
            video_url: trimmedVideoUrl || undefined,
            target_url: trimmedTargetUrl || undefined,
            published
        };

        try {
            await onSubmit(input);
            setTitle('');
            setSummary('');
            setMediaType('none');
            setImageUrl('');
            setVideoUrl('');
            setTargetUrl('');
            setPublished(false);
            setLocalError(null);
        } catch {
            // Parent handles error display
        }
    };

    const displayError = localError || errorMessage;
    const formHeading = isEdit && initialData ? `Edit News: ${initialData.title}` : 'Create News';
    const submitLabel = isEdit
        ? (isSubmitting ? 'Saving...' : 'Save Changes')
        : (isSubmitting ? 'Creating...' : 'Create News');

    const showImagePreview = mediaType === 'image' && imageUrl.trim() && isValidHttpUrl(imageUrl.trim());
    const showVideoPreview = mediaType === 'video' && videoUrl.trim() && isValidVideoUrl(videoUrl.trim());

    return (
        <form onSubmit={handleSubmit} className="form-card" aria-label={formHeading} style={{ maxWidth: '640px' }}>
            <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
                <h3 className="card-title">{formHeading}</h3>
            </div>

            {displayError && (
                <div role="alert" className="alert alert-danger">
                    {displayError}
                </div>
            )}

            <div className="form-group">
                <label htmlFor="news-title" className="form-label">Title (max 200 chars): <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                    id="news-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    maxLength={250}
                />
            </div>

            <div className="form-group">
                <label htmlFor="news-summary" className="form-label">Summary (optional, max 1000 chars):</label>
                <textarea
                    id="news-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    style={{ minHeight: '80px' }}
                    maxLength={1100}
                />
            </div>

            {/* Media Type Selector */}
            <div className="form-group">
                <label className="form-label">Media Type:</label>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                            type="radio"
                            name="media-type"
                            value="none"
                            checked={mediaType === 'none'}
                            onChange={() => handleMediaTypeChange('none')}
                            disabled={isSubmitting}
                            data-testid="media-type-none"
                        />
                        No Media
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                            type="radio"
                            name="media-type"
                            value="image"
                            checked={mediaType === 'image'}
                            onChange={() => handleMediaTypeChange('image')}
                            disabled={isSubmitting}
                            data-testid="media-type-image"
                        />
                        Image
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                            type="radio"
                            name="media-type"
                            value="video"
                            checked={mediaType === 'video'}
                            onChange={() => handleMediaTypeChange('video')}
                            disabled={isSubmitting}
                            data-testid="media-type-video"
                        />
                        Video
                    </label>
                </div>
            </div>

            {/* Image URL Input */}
            {mediaType === 'image' && (
                <div className="form-group">
                    <label htmlFor="news-image-url" className="form-label">Image URL (optional, http/https):</label>
                    <input
                        id="news-image-url"
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        placeholder="https://example.com/banner.png"
                        data-testid="news-image-url-input"
                    />
                </div>
            )}

            {/* Video URL Input */}
            {mediaType === 'video' && (
                <div className="form-group">
                    <label htmlFor="news-video-url" className="form-label">Video URL (optional, http/https, .mp4/.webm):</label>
                    <input
                        id="news-video-url"
                        type="text"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        disabled={isSubmitting}
                        className="form-control"
                        placeholder="https://example.com/trailer.mp4"
                        data-testid="news-video-url-input"
                    />
                </div>
            )}

            {/* Media Previews */}
            {showImagePreview && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Image Preview:</div>
                    <img
                        src={imageUrl.trim()}
                        alt="News preview"
                        data-testid="news-media-image-preview"
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 'var(--radius-md)', objectFit: 'contain', border: '1px solid var(--border-color)' }}
                    />
                </div>
            )}

            {showVideoPreview && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Video Preview:</div>
                    <video
                        src={videoUrl.trim()}
                        controls
                        preload="metadata"
                        data-testid="news-media-video-preview"
                        style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}
                    />
                </div>
            )}

            <div className="form-group">
                <label htmlFor="news-target-url" className="form-label">Target URL (optional, http/https):</label>
                <input
                    id="news-target-url"
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isSubmitting}
                    className="form-control"
                    placeholder="https://example.com/announcement"
                />
            </div>

            <div className="form-group">
                <label htmlFor="news-published" className="form-checkbox-label">
                    <input
                        id="news-published"
                        type="checkbox"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        disabled={isSubmitting}
                    />
                    <span>{isEdit ? 'Published' : 'Publish immediately'}</span>
                </label>
            </div>

            <div className="form-actions">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                >
                    {submitLabel}
                </button>
                {isEdit && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="btn btn-secondary"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};
