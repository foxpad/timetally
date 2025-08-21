// calendar.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CalendarExport from './components/CalendarExport';
import "./index.css";

const root = createRoot(document.getElementById("root")!);

root.render(
    <StrictMode>
        <CalendarExport />
    </StrictMode>
);