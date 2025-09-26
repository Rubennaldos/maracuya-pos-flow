// Hook para obtener anuncios activos
import { useEffect, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import type { AnnouncementT } from "@/components/modules/lunch/types";

export function useActiveAnnouncements() {
  const [announcements, setAnnouncements] = useState<AnnouncementT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = RTDBHelper.listenToData<Record<string, AnnouncementT>>(
      "lunch_announcements",
      (data) => {
        if (data) {
          const now = Date.now();
          const activeAnnouncements = Object.values(data)
            .filter(Boolean)
            .filter(announcement => 
              announcement.active && 
              now >= announcement.startAt && 
              now <= announcement.endAt
            )
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          
          setAnnouncements(activeAnnouncements);
        } else {
          setAnnouncements([]);
        }
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { announcements, loading };
}