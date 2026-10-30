import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Alarms from './pages/Alarms';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import Topology from './pages/Topology';
import AgentLogs from './pages/AgentLogs';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview"       element={<Overview />} />
        <Route path="/alarms"         element={<Alarms />} />
        <Route path="/incidents"      element={<Incidents />} />
        <Route path="/incidents/:id"  element={<IncidentDetail />} />
        <Route path="/topology"       element={<Topology />} />
        <Route path="/agents"         element={<AgentLogs />} />
      </Route>
    </Routes>
  );
}
