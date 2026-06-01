useEffect(() => {
  const channel = supabase
    .channel('files-changes')
    .on(
      'postgres_changes',
      {
        event: '*',          // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'files',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setFiles(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setFiles(prev => prev.filter(f => f.id !== payload.old.id))
        }
      }
    )
    .subscribe()
 
  return () => supabase.removeChannel(channel)
}, [userId])