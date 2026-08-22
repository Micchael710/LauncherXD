import React from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';

export interface MobileNavigationProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="mobile-nav-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Mobile Navigation">
            <div className="mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="mobile-nav-header">
                    <span className="mobile-nav-title">Menu</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon mobile-nav-close"
                        aria-label="Close navigation menu"
                    >
                        <X size={20} />
                    </button>
                </div>
                <Sidebar onNavigate={onClose} className="sidebar-mobile" />
            </div>
        </div>
    );
};
