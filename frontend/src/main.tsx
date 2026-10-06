import { ChakraProvider } from '@chakra-ui/react';
import { CacheProvider } from '@emotion/react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { createApplicationEmotionCache } from './emotion-cache.js';
import { nocSystem } from './theme.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application mount element is missing');

const initialLanguage = navigator.language.toLowerCase().startsWith('fa') ? 'fa' : 'en';
const emotionCache = createApplicationEmotionCache();
createRoot(root).render(
  <CacheProvider value={emotionCache}>
    <ChakraProvider value={nocSystem}>
      <App initialLanguage={initialLanguage} />
    </ChakraProvider>
  </CacheProvider>,
);
