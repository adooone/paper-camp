import { useAppStore } from '@/app/stores/app-store';
import { useNavigate } from '@tanstack/react-router';
import { entityLink } from './use-route-selection';

/** Navigates to an entity given only its id/title. A ticket's URL nests under its
 *  board, which the caller usually doesn't know — so resolve the entity from the
 *  worklist first and let `entityLink` decide the shape. */
export function useOpenEntity(): (id: string | null | undefined, title: string) => void {
  const navigate = useNavigate();
  const plans = useAppStore((s) => s.plans);
  return (id, title) => {
    const entity = (plans?.entries ?? []).find((p) => (id ? p.id === id : p.title === title));
    navigate(entityLink(entity ?? { id, title }));
  };
}
