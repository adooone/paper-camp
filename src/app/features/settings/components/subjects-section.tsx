import { EmptyState } from '@/app/components';
import { useSubjectVocabulary } from '@/app/hooks';
import { Button, Card, Divider } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export const SubjectsSection = () => {
  const { subjects, loading, available } = useSubjectVocabulary();
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6">
        <h2 className="m-0">Subjects</h2>
        <p className="opacity-50 mt-1">
          Subjects are the roadmap's bets and standing concerns. Edit the vocabulary on the Roadmap
          page.
        </p>
      </div>
      {loading && <p>Loading…</p>}
      {!loading && !available && (
        <p className="opacity-60 m-0">Couldn't load subjects — check the server config.</p>
      )}
      {!loading && available && (
        <Card size="small" texture="kraft">
          {subjects.length === 0 && <EmptyState message="No subjects yet." />}
          {subjects.map((name, idx) => (
            <div key={name}>
              <div className="pb-2 pt-2">{name}</div>
              {idx < subjects.length - 1 && <Divider />}
            </div>
          ))}
          {subjects.length > 0 && <Divider />}
          <div className="pt-3">
            <Button size="small" onClick={() => navigate({ to: '/roadmap' })}>
              Go to Roadmap
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
