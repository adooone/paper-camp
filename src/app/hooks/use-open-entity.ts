import { useNavigate } from '@tanstack/react-router';
import { entityLink } from './use-route-selection';
import { useWorklist } from './use-worklist';

/** Navigates to an entity given only its id/title. A ticket's URL nests under its
 *  board, which the caller usually doesn't know — so resolve the entity from the
 *  worklist first and let `entityLink` decide the shape. */
export function useOpenEntity(): (id: string | null | undefined, title: string) => void {
  const navigate = useNavigate();
  const { worklist } = useWorklist();
  return (id, title) => {
    const row = (worklist ?? []).find((p) => (id ? p.id === id : p.title === title));
    navigate(
      entityLink(
        row
          ? { id: row.id, title: row.title, entityKind: row.kind, idea: row.parent }
          : { id, title },
      ),
    );
  };
}
