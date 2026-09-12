import {useCallback, useState} from 'react';
import {AddForm} from '../components/AddForm.jsx';
import {JobList} from '../components/JobList.jsx';
import {DownloaderPanel, HowItWorksPanel, StatsPanel} from '../components/Sidebar.jsx';
import {api} from '../lib/api.js';
import {summarize} from '../lib/jobs.js';

export function DashboardPage({data, refresh, onError}) {
  const [adding, setAdding] = useState(false);
  const [busyJobId, setBusyJobId] = useState(null);

  const addJob = useCallback(async (url) => {
    setAdding(true);
    try {
      await api.addJob(url);
      await refresh();
      return true;
    } catch (e) {
      onError(e);
      return false;
    } finally {
      setAdding(false);
    }
  }, [refresh, onError]);

  const jobAction = useCallback(async (id, action) => {
    setBusyJobId(id);
    try {
      await api.jobAction(id, action);
      await refresh();
    } catch (e) {
      onError(e);
    } finally {
      setBusyJobId(null);
    }
  }, [refresh, onError]);

  return (
    <section className="dashboard">
      <div className="dashboard-main">
        <header className="page-heading">
          <p className="eyebrow">Your collection</p>
          <h1>Bring it home.</h1>
        </header>
        <AddForm onSubmit={addJob} busy={adding} />
        <JobList jobs={data.jobs} progress={data.progress} onAction={jobAction} busyJobId={busyJobId} />
      </div>
      <aside className="dashboard-side">
        <StatsPanel summary={summarize(data.jobs)} />
        <DownloaderPanel />
        <HowItWorksPanel />
      </aside>
    </section>
  );
}
