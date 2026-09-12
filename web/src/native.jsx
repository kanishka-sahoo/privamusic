import {createRoot} from 'react-dom/client';
import './styles/global.css';
import {NativeDesktopPage} from './pages/NativeDesktopPage.jsx';

// No StrictMode here: its double-invoked effects would open and tear down a second VNC session.
createRoot(document.getElementById('root')).render(<NativeDesktopPage />);
