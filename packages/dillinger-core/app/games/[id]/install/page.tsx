import WineInstallWizard from '@/app/components/WineInstallWizard';

interface InstallPageProps {
  params: Promise<{ id: string }>;
}

export default async function GameInstallPage({ params }: InstallPageProps) {
  const { id } = await params;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <WineInstallWizard gameId={id} />
    </div>
  );
}
