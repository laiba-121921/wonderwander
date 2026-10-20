import TodayScreen from './features/today/TodayScreen';
import MapScreen from './features/map/MapScreen';
import LibraryScreen from './features/library/LibraryScreen';
import SettingsScreen from './features/settings/SettingsScreen';

export const tabs = [
  { path: '/', label: 'Today', element: <TodayScreen /> },
  { path: '/map', label: 'Map', element: <MapScreen /> },
  { path: '/library', label: 'Library', element: <LibraryScreen /> },
  { path: '/me', label: 'Me', element: <SettingsScreen /> },
];
