useEffect(() => {
  if (!userId) return;

  const channel = supabase
    .channel('files-changes-' + userId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'files',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      console.log('[Realtime]', payload); // ← remove after confirming it works
      if (payload.eventType === 'INSERT') {
        setFiles(prev => [payload.new, ...prev]);
      } else if (payload.eventType === 'DELETE') {
        setFiles(prev => prev.filter(f => f.id !== payload.old.id));
      } else if (payload.eventType === 'UPDATE') {
        setFiles(prev => prev.map(f => f.id === payload.new.id ? payload.new : f));
      }
    })
    .subscribe((status) => {
      console.log('[Realtime status]', status); // SUBSCRIBED = working
    });

  return () => supabase.removeChannel(channel);
}, [userId]);