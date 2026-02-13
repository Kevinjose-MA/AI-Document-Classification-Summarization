import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import DocumentsPage from "./pages/DocumentPage";
import UploadPage from "./pages/UploadPage";
import DocumentViewer from "./pages/DocumentViewer";
import Layout from "./components/Layout";

// Simple auth check (we will improve later)
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="documents/:id" element={<DocumentViewer />} />

          {/* Default route after login */}
          <Route index element={<Navigate to="dashboard" />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
