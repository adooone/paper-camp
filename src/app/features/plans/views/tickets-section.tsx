import { entityRouteParam } from '@/app/hooks';
import { createTicket } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';
import { AddTicketButton } from '../actions';
import { PlanRows } from './plan-rows';

const sectionHeadingClass = 'font-display-luminari text-sm font-semibold opacity-[0.65]';

/** A board's decomposition, in the same row treatment the main worklist uses
 * (IDEA-201) — never the phases Table, since a board carries no phases of its own.
 * Adding a ticket stays on this view: it posts straight to the board's own list
 * and reloads, rather than navigating to a separate creation flow. */
interface TicketsSectionProps {
  plan: PlanEntry;
  otherPlans: PlanEntry[];
}

export const TicketsSection = ({ plan, otherPlans }: TicketsSectionProps) => {
  const navigate = useNavigate();
  const loadPlans = useAppStore((s) => s.loadPlans);
  const tickets = otherPlans.filter((p) => p.entityKind === 'ticket' && p.idea === plan.id);
  const handleOpen = (title: string) => {
    const ticket = tickets.find((t) => t.title === title);
    if (!ticket) return;
    navigate({
      to: '/plans/$planId',
      params: { planId: entityRouteParam(ticket.id, ticket.title) },
    });
  };
  const handleAddTicket = async (title: string) => {
    if (!plan.id) return;
    await createTicket({ boardId: plan.id, title });
    await loadPlans();
  };
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${sectionHeadingClass} m-0`}>Tickets</h3>
        <AddTicketButton onAdd={handleAddTicket} disabled={!plan.id} />
      </div>
      {tickets.length > 0 ? (
        <PlanRows plans={tickets} onOpen={handleOpen} />
      ) : (
        <p className="text-sm m-0 opacity-50">
          No tickets yet — add one to start the decomposition.
        </p>
      )}
    </div>
  );
};
