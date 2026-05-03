import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import LibraryPage from './pages/Library/LibraryPage';
import SearchPage from './pages/Search/SearchPage';
import AiAssistantPage from './pages/AiAssistant/AiAssistantPage';
import SettingsPage from './pages/Settings/SettingsPage';
import ReaderPage from './pages/Reader/ReaderPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<LibraryPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="ai" element={<AiAssistantPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reader/:bookId" element={<ReaderPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
