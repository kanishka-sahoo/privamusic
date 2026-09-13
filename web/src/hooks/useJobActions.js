import {useCallback, useState} from 'react';
import {api} from '../lib/api.js';

// Add, retry and cancel handlers shared by every page; failures surface through onError.
export function useJobActions(refresh, onError) {
  const [adding, setAdding] = useState(false);
  const [busyJobId, setBusyJobId] = useState(null);

  const addJob = useCallback(async (url) => {
    setAdding(true);
    try {
      const job = await api.addJob(url);
      await refresh();
      return job;
    } catch (e) {
      onError(e);
      return null;
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

  return {addJob, adding, jobAction, busyJobId};
}
