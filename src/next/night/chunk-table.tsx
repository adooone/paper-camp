import { Table } from '@dendelion/folk-ui';
import { nightFindingKey } from '@/core/night-findings';
import { type ChunkRow, findingLocation, SEVERITY_MEANING } from '../shell/night-model';
import { Hand } from '../ui/hand';
import { Stamp } from '../ui/stamp';
import { FindingActions, FixAll } from './finding-actions';
import styles from './night.module.css';

const FindingList = ({ row }: { row: ChunkRow }) => (
  <div className={styles.findings}>
    {row.findings.map((finding) => (
      <article key={nightFindingKey(finding)} className={styles.finding}>
        <div className={styles.findingHead}>
          <Stamp meaning={SEVERITY_MEANING[finding.severity]}>{finding.severity}</Stamp>
          <Stamp>{finding.check}</Stamp>
          <span className={`${styles.mono} ${styles.location}`} title={findingLocation(finding)}>
            {findingLocation(finding)}
          </span>
          <FindingActions finding={finding} />
        </div>
        <Hand size="sm" color="inkSoft">
          {finding.message}
        </Hand>
      </article>
    ))}
  </div>
);

export const ChunkTable = ({ rows }: { rows: ChunkRow[] }) => (
  <div className={styles.tableWrap}>
    <Table
      data={rows}
      rowKey={(row) => row.chunk}
      density="compact"
      expandable={{ render: (row) => <FindingList row={row} /> }}
      columns={[
        {
          key: 'chunk',
          width: 3,
          header: 'Chunk',
          cell: (row) => <span className={styles.mono}>{row.chunk}</span>,
        },
        {
          key: 'severity',
          width: 3,
          header: 'Findings',
          cell: (row) => (
            <span className={styles.stamps}>
              {row.counts.map(({ severity, count }) => (
                <Stamp key={severity} meaning={SEVERITY_MEANING[severity]}>
                  {`${count} ${severity}`}
                </Stamp>
              ))}
            </span>
          ),
        },
        {
          key: 'checks',
          width: 2,
          header: 'Checks',
          cell: (row) => (
            <Hand size="sm" color="inkSoft">
              {row.checks}
            </Hand>
          ),
        },
        {
          key: 'actions',
          width: 1,
          header: '',
          align: 'end',
          cell: (row) => <FixAll findings={row.findings} />,
        },
      ]}
    />
  </div>
);
