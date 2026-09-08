import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
    className = '', 
    style = {}, 
    width, 
    height, 
    borderRadius 
}) => {
    const inlineStyle: React.CSSProperties = {
        ...style,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(borderRadius !== undefined ? { borderRadius } : {}),
    };

    return <div className={`luniq-skeleton ${className}`} style={inlineStyle} aria-hidden="true" />;
};

/* ── Home Page Loading Skeleton ── */
export const HomeSkeleton: React.FC = () => {
    return (
        <div className="home-container skeleton-page-container">
            <header className="home-header">
                <Skeleton width="180px" height="32px" borderRadius="8px" style={{ marginBottom: '8px' }} />
            </header>

            <div className="section-list">
                {/* Six pack section */}
                <div className="skeleton-section">
                    <div className="skeleton-cards-grid six-pack">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={`six-${i}`} className="skeleton-card horizontal">
                                <Skeleton width="56px" height="56px" borderRadius="8px" />
                                <div className="skeleton-card-text">
                                    <Skeleton width="70%" height="14px" borderRadius="4px" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recommended cards grid */}
                <div className="skeleton-section">
                    <div className="skeleton-section-header">
                        <Skeleton width="140px" height="22px" borderRadius="6px" />
                    </div>
                    <div className="skeleton-cards-grid">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={`rec-${i}`} className="skeleton-card vertical">
                                <Skeleton width="100%" height="150px" borderRadius="10px" />
                                <Skeleton width="80%" height="14px" borderRadius="4px" style={{ marginTop: '10px' }} />
                                <Skeleton width="50%" height="11px" borderRadius="4px" style={{ marginTop: '6px' }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── Playlist / Album Page Loading Skeleton ── */
export const PlaylistSkeleton: React.FC = () => {
    return (
        <div className="playlist-container skeleton-page-container">
            <div className="skeleton-playlist-header">
                <Skeleton width="190px" height="190px" borderRadius="12px" className="skeleton-hero-art" />
                <div className="skeleton-playlist-meta">
                    <Skeleton width="60px" height="12px" borderRadius="4px" />
                    <Skeleton width="65%" height="38px" borderRadius="8px" style={{ margin: '10px 0' }} />
                    <Skeleton width="40%" height="14px" borderRadius="4px" />
                    <div className="skeleton-action-row" style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                        <Skeleton width="46px" height="46px" borderRadius="50%" />
                        <Skeleton width="36px" height="36px" borderRadius="50%" />
                    </div>
                </div>
            </div>

            <div className="skeleton-tracklist" style={{ marginTop: '36px' }}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={`tr-${i}`} className="skeleton-track-row">
                        <Skeleton width="20px" height="14px" borderRadius="3px" />
                        <Skeleton width="40px" height="40px" borderRadius="6px" />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <Skeleton width="45%" height="13px" borderRadius="4px" />
                            <Skeleton width="25%" height="10px" borderRadius="4px" />
                        </div>
                        <Skeleton width="60px" height="12px" borderRadius="4px" />
                        <Skeleton width="40px" height="12px" borderRadius="4px" />
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ── Track Details Loading Skeleton ── */
export const TrackViewSkeleton: React.FC = () => {
    return (
        <div className="track-view-container skeleton-page-container" style={{ padding: '32px 40px' }}>
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center', marginBottom: '36px' }}>
                <Skeleton width="200px" height="200px" borderRadius="14px" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Skeleton width="80px" height="12px" borderRadius="4px" />
                    <Skeleton width="60%" height="34px" borderRadius="8px" />
                    <Skeleton width="35%" height="15px" borderRadius="4px" />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Skeleton width="120px" height="20px" borderRadius="6px" style={{ marginBottom: '8px' }} />
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} width="100%" height="48px" borderRadius="8px" />
                ))}
            </div>
        </div>
    );
};


