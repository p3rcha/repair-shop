import { Navigate, Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "@/routes/ProtectedRoute"
import { AppLayout } from "@/routes/AppLayout"
import { Login } from "@/routes/Login"
import { Estimates } from "@/routes/Estimates"
import { NewEstimate } from "@/routes/NewEstimate"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/estimates" replace />} />
          <Route path="/estimates" element={<Estimates />} />
          <Route path="/estimates/new" element={<NewEstimate />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
