export const RuntimeUnavailable = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
    <p className="font-handwritten text-lg">This needs the runtime</p>
    <p className="max-w-sm text-sm opacity-60">
      Connect the project's runtime to use this — it owns the filesystem, git and the agent.
    </p>
  </div>
);
