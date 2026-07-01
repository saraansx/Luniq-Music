import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CreatePlaylistModal.css';
import { useLanguage } from '../../context/LanguageContext';

interface PlaylistData {
    name: string;
    description: string;
    artwork: string | null;
}

interface CreatePlaylistModalProps {
    onClose: () => void;
    onCreate: (playlist: PlaylistData) => void;
        editData?: PlaylistData;
}

const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({ onClose, onCreate, editData }) => {
    const [name, setName] = useState(editData?.name || '');
    const [description, setDescription] = useState(editData?.description || '');
                                      
    const [artwork, setArtwork] = useState<string | null>(editData?.artwork || null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isEditMode = !!editData;
    const { t } = useLanguage();

    const handleArtworkClick = () => {
        if (loading) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setArtwork(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!name.trim() || loading) return;

        setLoading(true);
        try {
            await onCreate({ name: name.trim(), description: description.trim(), artwork });
            onClose();
        } catch (error) {
            console.error("Failed to create playlist:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (loading) return;
        if (e.target === e.currentTarget) onClose();
    };

    return createPortal(
        <div className="create-playlist-overlay" onClick={handleOverlayClick}>
            <div className="create-playlist-modal">
                {/* Header */}
                <div className="create-playlist-header">
                    <h3>{isEditMode ? t('createPlaylist.editDetails') : t('createPlaylist.create')}</h3>
                    <button className="modal-close-btn" onClick={onClose} title={t('nowPlaying.close')} disabled={loading}>
                        &times;
                    </button>
                </div>

                <div className="create-playlist-body">
                    {/* Left Column: Artwork picker */}
                    <div
                        className={`artwork-picker ${artwork ? 'has-image' : ''}`}
                        onClick={handleArtworkClick}
                    >
                        {artwork ? (
                            <img src={artwork} alt="Playlist artwork" className="artwork-preview" />
                        ) : (
                            <>
                                <svg className="artwork-placeholder-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <span className="artwork-placeholder-text">{isEditMode ? t('createPlaylist.changeArtwork') : t('createPlaylist.addArtwork')}</span>
                            </>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Right Column: Form fields */}
                    <div className="create-playlist-form">
                        <div className="form-field">
                            <input
                                type="text"
                                placeholder={t('createPlaylist.namePlaceholder')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                maxLength={100}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-field description-field">
                            <textarea
                                placeholder={t('createPlaylist.descriptionPlaceholder')}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={300}
                                disabled={loading}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions at the bottom */}
                <div className="create-playlist-actions">
                    <button className="btn-cancel" onClick={onClose} disabled={loading}>{t('createPlaylist.cancel')}</button>
                    <button
                        className={`btn-create ${loading ? 'loading' : ''}`}
                        onClick={handleSubmit}
                        disabled={!name.trim() || loading}
                    >
                        {loading ? (
                            <svg className="spinner" viewBox="0 0 50 50">
                                <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
                            </svg>
                        ) : (
                            isEditMode ? t('createPlaylist.save') : t('createPlaylist.create')
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CreatePlaylistModal;
