import { HashRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import LibraryPage from './pages/Library/LibraryPage';
import SearchPage from './pages/Search/SearchPage';
import AiAssistantPage from './pages/AiAssistant/AiAssistantPage';
import SettingsPage from './pages/Settings/SettingsPage';
import ReaderPage from './pages/Reader/ReaderPage';
import KnowledgeCardsPage from './pages/KnowledgeCards/KnowledgeCardsPage';
import ExportPage from './pages/Export/ExportPage';
import UpdateModal from './components/UpdateModal';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<LibraryPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="ai" element={<AiAssistantPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reader/:bookId" element={<ReaderPage />} />
          <Route path="knowledge-cards" element={<KnowledgeCardsPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
      <UpdateModal />
    </HashRouter>
  );
}

export default App;
