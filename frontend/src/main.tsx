import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application mount element is missing');

const initialLanguage = navigator.language.toLowerCase().startsWith('fa') ? 'fa' : 'en';
createRoot(root).render(<App initialLanguage={initialLanguage} />);
