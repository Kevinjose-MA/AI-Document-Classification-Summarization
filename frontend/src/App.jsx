// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login          from "./pages/Login";
import Register       from "./pages/Register";
import Dashboard      from "./pages/Dashboard";
import DocumentsPage  from "./pages/DocumentPage";
import UploadPage     from "./pages/UploadPage";
import DocumentViewer from "./pages/DocumentViewer";
import IngestionPage  from "./pages/IngestionPage";
import UsersPage      from "./pages/UsersPage";
import Settings       from "./pages/Settings";
import Analytics      from "./pages/Analytics";
import Layout         from "./components/Layout";
import AuditLogPage   from "./pages/AuditLogPage";
import Onboarding     from "./pages/Onboarding";

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />}    />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index                element={<Navigate to="dashboard" />}  />
          <Route path="dashboard"     element={<Dashboard />}                />
          <Route path="documents"     element={<DocumentsPage />}            />
          <Route path="documents/:id" element={<DocumentViewer />}           />
          <Route path="upload"        element={<UploadPage />}               />
          <Route path="ingestion"     element={<IngestionPage />}            />
          <Route path="analytics"     element={<Analytics />}                />
          <Route path="users"         element={<UsersPage />}                />
          <Route path="settings"      element={<Settings />}                 />
          <Route path="/audit-log"    element={<AuditLogPage />}             />
          <Route path="onboarding"    element={<Onboarding />}               />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}