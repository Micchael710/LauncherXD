import type { LucideIcon } from 'lucide-react';
import {
    LayoutDashboard,
    Users,
    Newspaper,
    Server,
    Terminal,
    Archive,
    CheckSquare,
    Package,
    Layers,
    Settings
} from 'lucide-react';

export interface NavItemConfig {
    label: string;
    path: string;
    icon: LucideIcon;
    exact?: boolean;
}

export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, exact: true },
    { label: 'Skins', path: '/skins', icon: Users },
    { label: 'News', path: '/news', icon: Newspaper },
    { label: 'Server', path: '/server', icon: Server },
    { label: 'Console', path: '/console', icon: Terminal },
    { label: 'Backups', path: '/backups', icon: Archive },
    { label: 'Tasks', path: '/tasks', icon: CheckSquare },
    { label: 'Modpack', path: '/modpack', icon: Package },
    { label: 'Versions', path: '/releases', icon: Layers },
    { label: 'Settings', path: '/settings', icon: Settings }
];
