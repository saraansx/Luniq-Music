import { useState, useEffect } from 'react';
import './StarPopup.css';
import luneLogo from '../../assets/Lune.png';

const StarPopup = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const checkStarStatus = async () => {
            try {
                const hasStarred = await window.ipcRenderer.invoke('get-setting', 'has_starred');
                if (hasStarred) return; // Never show again once starred

                const startupCount: number = (await window.ipcRenderer.invoke('get-setting', 'startup_count')) || 1;
                const lastDismissedAt: number = (await window.ipcRenderer.invoke('get-setting', 'star_last_dismissed_at')) || 0;

                // Show on 1st open (lastDismissedAt is 0, meaning never dismissed)
                // After that, show again every 10 opens since the last dismissal
                const shouldShow = lastDismissedAt === 0 || (startupCount - lastDismissedAt) >= 10;

                if (shouldShow) {
                    // Slight delay for better UX
                    setTimeout(() => setIsVisible(true), 2000);
                }
            } catch (err) {
                console.error('Failed to check star status:', err);
            }
        };
        checkStarStatus();
    }, []);

    const handleStar = async () => {
        await window.ipcRenderer.invoke('open-external', 'https://github.com/saraansx/Lune-Music');
        await window.ipcRenderer.invoke('set-setting', 'has_starred', true);
        setIsVisible(false);
    };

    const handleLater = async () => {
        // Record current startup count so the popup waits another 10 opens
        const startupCount = await window.ipcRenderer.invoke('get-setting', 'startup_count');
        await window.ipcRenderer.invoke('set-setting', 'star_last_dismissed_at', startupCount || 1);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="star-popup-overlay">
            <div className="star-popup-glass">
                <div className="star-close-id" onClick={handleLater}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
                
                <div className="star-popup-content">
                    <div className="star-logo-wrapper">
                        <img src={luneLogo} alt="Lune Logo" className="star-lune-logo" />
                    </div>
                    
                    <div className="star-text-stack">
                        <h2 className="star-popup-title">Support Lune</h2>
                        
                        <p className="star-popup-note">
                            Hey there! I'm <b>saraansx</b>, the developer of Lune. <br /><br />
                            I hope you're enjoying your ad-free music journey. If so, would you mind starring our repository? It's a small click for you, but it truly helps the project grow and stay alive!
                        </p>
                        
                        <div className="star-popup-actions">
                            <button className="star-btn secondary" onClick={handleLater}>
                                Maybe Later
                            </button>
                            <button className="star-btn primary" onClick={handleStar}>
                                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                                    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                                </svg>
                                Star on GitHub
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StarPopup;
