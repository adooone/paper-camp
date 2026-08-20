import { PageTitle } from '@/app/components/page-title';

export const IssuesPage = () => {
  return (
    <div>
      <PageTitle>Issues</PageTitle>
      <p className="opacity-50">
        Failed agent runs, red checks, PR review requests, and sync failures will collect here.
      </p>
    </div>
  );
};
