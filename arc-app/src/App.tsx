/**
 * Главный компонент приложения ARC
 * Artist Reference Collection
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  CardsPage,
  CollectionsPage,
  TagsPage,
  MoodboardPage,
  SettingsPage,
  AddPage
} from './pages';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CardsPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/moodboard" element={<MoodboardPage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
