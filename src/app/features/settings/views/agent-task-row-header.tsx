export const AGENT_TABLE_GRID_CLASS = 'grid grid-cols-[110px_140px_160px_110px] gap-3 items-center';

export const AgentTaskRowHeader = () => (
  <div className="plan-row-card">
    <div className="overflow-x-auto">
      <div className={AGENT_TABLE_GRID_CLASS}>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Task</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Agent</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Model</span>
        <span className="font-handwritten text-sm opacity-60 whitespace-nowrap">Effort</span>
      </div>
    </div>
  </div>
);
