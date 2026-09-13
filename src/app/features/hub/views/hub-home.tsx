import { Input } from '@dendelion/paper-ui';
import { useState } from 'react';
import { AddMachineFooter, ContinueStrip, HubNumbersColumn, MachineSection } from '../components';
import { pickContinueTarget } from '../helpers/continue-target';
import {
  SEARCH_ROW_THRESHOLD,
  filterHubMachines,
  totalProjectCount,
} from '../helpers/filter-machines';
import { useHubMachines, useHubNumbers } from '../hooks';

export const HubHome = () => {
  const { machines, chosenRuntimeUrls, openRow, renameRow, forgetRow, retryMachine } =
    useHubMachines();
  const [query, setQuery] = useState('');

  const continueTarget = pickContinueTarget(machines);
  const showSearch = totalProjectCount(machines) > SEARCH_ROW_THRESHOLD;
  const visibleMachines = showSearch ? filterHubMachines(machines, query) : machines;
  const numbers = useHubNumbers(machines, totalProjectCount(machines), continueTarget);

  return (
    <div className="grid grid-cols-[2fr_1fr] gap-6 items-start max-[480px]:grid-cols-1">
      <div className="flex flex-col gap-6">
        {continueTarget && (
          <ContinueStrip
            target={continueTarget}
            onOpen={() => openRow(continueTarget.row, continueTarget.machineUrl)}
          />
        )}
        {showSearch && (
          <Input
            size="small"
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {visibleMachines.length === 0 ? (
          <p className="m-0 text-sm opacity-70">
            {machines.length === 0
              ? 'Nothing here yet — add a machine below.'
              : 'No project matches your search.'}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {visibleMachines.map((machine) => (
              <MachineSection
                key={machine.machineUrl}
                machine={machine}
                chosenRuntimeUrls={chosenRuntimeUrls}
                onOpenRow={(row) => openRow(row, machine.machineUrl)}
                onRenameRow={renameRow}
                onForgetRow={forgetRow}
                onRetry={() => retryMachine(machine.machineUrl)}
              />
            ))}
          </div>
        )}
        <AddMachineFooter />
      </div>
      <HubNumbersColumn numbers={numbers} />
    </div>
  );
};
