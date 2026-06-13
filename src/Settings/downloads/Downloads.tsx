import React, { useState, useEffect } from 'react';
import '../playback/Playback.css'; // Reusing Playback styles
import './Downloads.css';
import { useLanguage } from '../../context/LanguageContext';

const Downloads: React.FC = () => {
    const { t } = useLanguage();
    const [downloadLocation, setDownloadLocation] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedLocation = await window.ipcRenderer?.invoke('get-setting', 'downloadLocation');
                if (savedLocation) {
                    setDownloadLocation(savedLocation);
                } else {
                    const defaultLoc = await window.ipcRenderer?.invoke('get-default-download-location');
                    setDownloadLocation(defaultLoc || '');
                }
            } catch (e) {
                console.warn('Failed to load download settings', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSelectDirectory = async () => {
        try {
            const selectedDir = await window.ipcRenderer?.invoke('select-directory');
            if (selectedDir) {
                setDownloadLocation(selectedDir);
                await window.ipcRenderer?.invoke('set-setting', 'downloadLocation', selectedDir);
            }
        } catch (e) {
            console.error('Failed to select directory', e);
        }
    };

    if (isLoading) return null;

    return (
        <div className="settings-language-card" style={{ position: 'relative' }}>
            <div className="settings-account-header">
                <h2 className="settings-account-title">{t('downloads.title') || 'Downloads'}</h2>
                <p className="settings-account-description">{t('downloads.sub') || 'Manage your local music storage and download paths.'}</p>
            </div>
            
            <div className="language-content">
                <div className="settings-row">
                    <div className="row-info">
                        <span className="row-label">{t('downloads.location') || 'Download location'}</span>
                        <span className="row-sub">
                            {downloadLocation || 'Not set'}
                        </span>
                    </div>
                    
                    <button 
                        className="dropdown-trigger" 
                        onClick={handleSelectDirectory}
                        title="Change folder"
                        style={{ width: 'auto', minWidth: '60px', justifyContent: 'center' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Downloads;
