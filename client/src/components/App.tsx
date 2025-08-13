import { BrowserRouter, Routes, Route, Form } from 'react-router-dom';
import CreateEvent from '../pages/CreateEvent';
import { LanguageProvider } from '../context/LanguageContext';
import EventsPage from '../pages/EventsPage';
import ArchivedEventPage from '../pages/ArchiveEventPage';
import EventDetail from '../pages/EventDetailPage';
import EditEvent from '../pages/EventEditPage';
import { StartParamRouter } from '../hooks/useStartParamRouting';

export default function App() {

  return (
    <LanguageProvider>
      <BrowserRouter>
        <StartParamRouter />
        <Routes>
          <Route path="/" element={<EventsPage />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/event/public/:publicId" element={<EventDetail />} />
          <Route path="/event/:id/edit" element={<EditEvent />} />

          {/* <Route path="/archive" element={<ArchivedEventPage />} /> */}
          {/* <Route path="/event/:id/results" element={<EventResultsPage />} /> */}


          <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}